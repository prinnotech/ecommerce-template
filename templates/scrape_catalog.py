#!/usr/bin/env python3
"""Build a products CSV (same columns as products-import-template.csv) from Nike and Luisaviaroma.

    python scrape_catalog.py --lang italian                    # the whole Nike catalog, by category
    python scrape_catalog.py --lang it --per-category 20       # quick sample: 20 models per category
    python scrape_catalog.py --lang en --url https://www.nike.com/it/w/uomo-nik1     # men only
    python scrape_catalog.py --lang it --url https://www.nike.com/it/w/best-seller-76m50

Nike: read live from nike.com (public listing + product feed, no browser needed).
  - --url is where to start (default: every product). The script reads that page's category list
    (Shoes, Tops and T-shirts, Hoodies, ...) and crawls each category, so every product gets the
    category it is listed under, plus the gender: "scarpe-uomo", "felpe-e-maglie-donna", ...
  - All colors of a model become one product with color + size variants.
  - --lang picks the store: it -> nike.com/it, es -> nike.com/es, en -> nike.com/ie (English, EUR).

Luisaviaroma: its site is behind a Cloudflare bot check, so the script doesn't crawl it. Open the
product pages in your normal browser, save them (Ctrl+S, "Webpage, HTML only") into a folder and
pass that folder with --lvr-pages (default: lvr_pages/ next to this script). Save them in the
--lang you want (luisaviaroma.com/it/... for Italian): the text is taken as it is on the page.

Standard library only. Output: products-import.csv next to this script unless --output is given.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
COLUMNS = (
    "handle,title_en,title_es,title_it,description_en,description_es,description_it,category,price,"
    "compare_at_price,status,featured,tags,size,color,color_hex,sku,variant_price,stock,image_urls"
).split(",")
LANG_ALIASES = {"it": "it", "italian": "it", "italiano": "it", "en": "en", "english": "en", "inglese": "en",
                "es": "es", "spanish": "es", "espanol": "es", "español": "es", "spagnolo": "es"}
NIKE_STORES = {"it": ("it", "IT", "it"), "es": ("es", "ES", "es-ES"), "en": ("ie", "IE", "en-GB")}  # url, market, language
NIKE_WALL_HEADERS = {"nike-api-caller-id": "nike:dotcom:browse:wall.client:2.0"}
FEED_BATCH = 40  # colors per product-feed request
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
MAX_IMAGES = 10  # the importer keeps at most 10

GENDER_NAMES = {
    "men": {"it": "uomo", "en": "men", "es": "hombre"},
    "women": {"it": "donna", "en": "women", "es": "mujer"},
    "kids": {"it": "bambini", "en": "kids", "es": "ninos"},
}
# Luisaviaroma product types (Nike uses its own category names).
LVR_TYPE_NAMES = {
    "shoes": {"it": "scarpe", "en": "shoes", "es": "zapatos"},
    "clothing": {"it": "abbigliamento", "en": "clothing", "es": "ropa"},
    "bags": {"it": "borse", "en": "bags", "es": "bolsos"},
    "accessories": {"it": "accessori", "en": "accessories", "es": "accesorios"},
}


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def slugify(value: str, max_length: int = 90) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:max_length].strip("-")


def category_handle(name: str, gender: str, lang: str) -> str:
    """"Scarpe" + men -> "scarpe-uomo" (English: "men-shoes"). Unisex products get no gender."""
    gender_name = GENDER_NAMES.get(gender, {}).get(lang)
    if not gender_name:
        return slugify(name)
    return slugify(f"{gender_name} {name}" if lang == "en" else f"{name} {gender_name}")


def html_to_text(value: str) -> str:
    """HTML description -> plain text with literal \\n line breaks (the importer turns them into new lines)."""
    value = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h\d)>", "\n", value or "")
    value = re.sub(r"(?i)<li[^>]*>", "- ", value)
    value = html.unescape(re.sub(r"<[^>]+>", "", value))
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return "\\n".join(line for line in lines if line)


def hex_color(value: str | None) -> str:
    value = (value or "").strip().lstrip("#")
    return f"#{value.lower()}" if re.fullmatch(r"[0-9a-fA-F]{6}", value) else ""


def money(value: float | None) -> str:
    return f"{float(value):.2f}" if value else ""


def get(url: str, headers: dict[str, str] | None = None, attempts: int = 3) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "it,en;q=0.8", **(headers or {})})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", "replace")
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    return ""


# --------------------------------------------------------------------------- Nike


def nike_wall_state(url: str) -> dict:
    page = get(url)
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    if not match:
        raise RuntimeError(f"no product data on {url}")
    return json.loads(match.group(1))["props"]["pageProps"]["initialState"]


def nike_categories(url: str) -> tuple[list[tuple[str, str]], str]:
    """[(category name in the store language, url)] from the page's category list, and the channel id."""
    state = nike_wall_state(url)
    facets = state["Wall"].get("facetNav") or {}
    categories = [(c["displayText"], c["navigation"]["pageUrl"]) for c in facets.get("categories") or []
                  if c.get("navigation", {}).get("pageUrl") and not c.get("selected")]
    if not categories:  # already a single category (or a list like best sellers): crawl it as it is
        title = state["Wall"].get("primaryHeading") or state["Wall"].get("title") or "nike"
        categories = [(str(title), url)]
    return categories, state["Config"]["channelId"]


WALL_PAGE_SIZE = 24  # the listing API rejects anything bigger


def nike_category_pages(url: str, per_category: int) -> tuple[list[dict], list[str]]:
    """First page of a category, plus the API paths of all its other pages.

    Pages are addressed by offset (anchor=24, 48, ...), so they can all be fetched in parallel
    instead of following "next" links one by one."""
    wall = nike_wall_state(url)["Wall"]
    page_data = wall.get("pageData") or {}
    next_path, total = page_data.get("next"), int(page_data.get("totalResources") or 0)
    if per_category:
        total = min(total, per_category)
    if not next_path or "anchor=" not in next_path:
        return wall["productGroupings"], []
    paths = [re.sub(r"([?&]anchor=)\d+", rf"\g<1>{anchor}", next_path)
             for anchor in range(WALL_PAGE_SIZE, total, WALL_PAGE_SIZE)]
    return wall["productGroupings"], paths


def nike_wall_page(path: str) -> list[dict]:
    try:
        return json.loads(get("https://api.nike.com" + path, NIKE_WALL_HEADERS)).get("productGroupings") or []
    except Exception as error:  # a missing page loses 24 products, not the run
        log(f"  listing page skipped ({error})")
        return []


def nike_groups(groupings: list[dict]) -> list[tuple[str, list[dict]]]:
    """Listing groupings -> [(model key, color cards)]."""
    groups = []
    for grouping in groupings:
        cards = [card for card in grouping.get("products") or [] if card.get("productCode")]
        if cards:
            groups.append((cards[0].get("groupKey") or cards[0]["productCode"], cards))
    return groups


def nike_feed(styles: list[str], channel: str, lang: str) -> dict[str, tuple[dict, dict]]:
    """styleColor -> (productInfo, thread) for up to FEED_BATCH colors in one request."""
    _, marketplace, language = NIKE_STORES[lang]
    filters = [f"marketplace({marketplace})", f"language({language})", f"channelId({channel})",
               "exclusiveAccess(true,false)", f"productInfo.merchProduct.styleColor({','.join(styles)})"]
    query = "&".join("filter=" + urllib.parse.quote(value, safe="(),") for value in filters)
    feed = json.loads(get(f"https://api.nike.com/product_feed/threads/v2?{query}&count={len(styles) + 10}"))
    found = {}
    for thread in feed.get("objects") or []:
        for info in thread.get("productInfo") or []:
            style = info["merchProduct"].get("styleColor")
            if style in styles:
                found[style] = (info, thread)
    return found


def nike_images(thread: dict) -> list[str]:
    images: list[str] = []

    def collect(node) -> None:
        if isinstance(node, dict):
            props = node.get("properties") or {}
            image = props.get("squarishURL") or props.get("portraitURL")
            if image and image not in images:
                images.append(image)
            for value in node.values():
                collect(value)
        elif isinstance(node, list):
            for value in node:
                collect(value)

    collect((thread.get("publishedContent") or {}).get("nodes") or [])
    return images


def nike_gender(genders: list[str]) -> str:
    genders = {g.upper() for g in genders}
    if genders & {"BOYS", "GIRLS"}:
        return "kids"
    if genders == {"WOMEN"}:
        return "women"
    if genders == {"MEN"}:
        return "men"
    return ""  # unisex


def nike_product(category: str, cards: list[dict], details: dict[str, tuple[dict, dict]], lang: str, stock: int) -> dict | None:
    colors = [(card, *details[card["productCode"]]) for card in cards if card["productCode"] in details]
    if not colors:
        return None
    first_card, first_info, first_thread = colors[0]
    content, merch = first_info["productContent"], first_info["merchProduct"]
    prices = [float((info.get("merchPrice") or {}).get("currentPrice") or 0) for _, info, _ in colors]
    price = min(p for p in prices if p) if any(prices) else 0

    # Gallery of the first color, keeping room for the main photo of up to 4 other colors.
    other_colors = [img for _, _, thread in colors[1:5] for img in nike_images(thread)[:1]]
    images = nike_images(first_thread)[: MAX_IMAGES - len(other_colors)] + other_colors

    variants = []
    is_shoe = merch.get("productType") == "FOOTWEAR"
    for card, info, _ in colors:
        style, item = card["productCode"], info["productContent"]
        simple = next((c for c in item.get("colors") or [] if c.get("type") == "SIMPLE"), {})
        color = item.get("colorDescription") or simple.get("name") or ""
        color_price = float((info.get("merchPrice") or {}).get("currentPrice") or 0)
        available = {s.get("skuId"): s.get("available") for s in info.get("availableSkus") or []}
        for sku in info.get("skus") or [{}]:
            specs = sku.get("countrySpecifications") or [{}]
            size = str((specs[0].get("localizedSize") if is_shoe else None) or sku.get("nikeSize") or "One size")
            variants.append({
                "size": size, "color": color, "color_hex": hex_color(simple.get("hex")),
                "sku": f"NKE-{style}-{slugify(size).upper() or 'OS'}" if sku else f"NKE-{style}",
                "variant_price": color_price if color_price and color_price != price else None,
                "stock": stock if available.get(sku.get("id"), True) else 0,
            })

    full_price = float((first_info.get("merchPrice") or {}).get("fullPrice") or 0)
    title = content.get("fullTitle") or content.get("title") or first_card["copy"]["title"]
    group_key = first_card.get("groupKey") or first_card["productCode"]
    return {
        "handle": f"{slugify(title, 70)}-{slugify(group_key)}",
        "title": title,
        "description": html_to_text(content.get("description") or ""),
        "category": category_handle(category, nike_gender(merch.get("genders") or []), lang),
        "price": price,
        "compare_at_price": full_price if full_price > price else None,
        "tags": ["nike", *[slugify(t) for t in merch.get("sportTags") or []],
                 *(["best-seller"] if any(c.get("badgeAttribute") == "BEST_SELLER" for c in cards) else [])],
        "images": images,
        "variants": variants,
    }


def scrape_nike(url: str, lang: str, limit: int, per_category: int, stock: int, workers: int) -> list[dict]:
    prefix = NIKE_STORES[lang][0]
    url = re.sub(r"nike\.com/[a-z]{2}(?=/|$)", f"nike.com/{prefix}", url)
    categories, channel = nike_categories(url)
    log(f"Nike: {len(categories)} categories on {url}")

    with ThreadPoolExecutor(workers) as pool:
        firsts = list(pool.map(lambda c: nike_category_pages(c[1], per_category), categories))
        jobs = [(name, path) for (name, _), (_, paths) in zip(categories, firsts) for path in paths]
        log(f"Nike: reading {len(jobs) + len(categories)} listing pages")
        pages = list(pool.map(lambda job: nike_wall_page(job[1]), jobs))

    listed: dict[str, list[dict]] = {name: groupings for (name, _), (groupings, _) in zip(categories, firsts)}
    for (name, _), groupings in zip(jobs, pages):
        listed[name] += groupings

    # A model listed in two categories keeps the first one (the category list is ordered by Nike).
    models: dict[str, tuple[str, list[dict]]] = {}
    for name, _ in categories:
        groups = nike_groups(listed[name])[: per_category or None]
        log(f"  {name}: {len(groups)} models")
        for key, cards in groups:
            models.setdefault(key, (name, cards))
    items = list(models.values())[: limit or None]
    styles = [card["productCode"] for _, cards in items for card in cards]
    log(f"Nike: {len(items)} models, {len(styles)} colors - fetching details")

    batches = [styles[i:i + FEED_BATCH] for i in range(0, len(styles), FEED_BATCH)]
    details: dict[str, tuple[dict, dict]] = {}

    def fetch(batch: list[str]) -> dict:
        try:
            return nike_feed(batch, channel, lang)
        except Exception as error:  # one failed batch must not stop the run
            log(f"  batch skipped ({batch[0]}...): {error}")
            return {}

    with ThreadPoolExecutor(workers) as pool:
        for done, found in enumerate(pool.map(fetch, batches), start=1):
            details.update(found)
            if done % 25 == 0:
                log(f"  {done}/{len(batches)} requests")

    products = [p for name, cards in items if (p := nike_product(name, cards, details, lang, stock))]
    log(f"Nike: {len(products)} products")
    return products


# --------------------------------------------------------------------------- Luisaviaroma (saved pages)


def lvr_product(page: str, lang: str, stock: int) -> dict | None:
    match = re.search(r"window\.__SSR_productData\s*=\s*(\{.*?\});\s*</script>", page, re.S)
    if not match:
        return None
    data = json.loads(match.group(1))
    brand = html.unescape(str((data.get("brand") or {}).get("descr") or "")).strip()
    name = html.unescape(str(data.get("descr") or "")).strip()
    title = name if name.lower().startswith(brand.lower()) else f"{brand} {name}".strip()
    article = str(data.get("id") or data.get("codice") or "")

    sale = (data.get("prezzi_vendita") or [{}])[0]
    price, list_price = float(sale.get("prezzo_finale_ivato") or 0), float(sale.get("prezzo_listino_ivato") or 0)
    category2 = str((data.get("categoria2_default") or {}).get("descr_en") or "").lower()
    category3 = (data.get("categoria3_default") or {}).get("descr") or ""
    gender = {"F": "women", "M": "men", "K": "kids", "B": "kids"}.get(str((data.get("sesso") or {}).get("codice") or "").upper(), "")
    kind = category2 if category2 in LVR_TYPE_NAMES else "accessories" if category2 else "clothing"

    images: list[str] = []
    for url in [data.get("image_dettaglio"), *[p.get("image_dettaglio") for p in data.get("varianti_foto") or []],
                *re.findall(r'https://[^"\s\\]+?/articoli/[^"\s\\]+', match.group(1))]:
        if url and url.startswith("http") and url not in images:
            images.append(url)

    color, color_hex = str(data.get("descr_colore_commerciale") or ""), hex_color(data.get("rgb_colore_commerciale"))
    variants = []
    for entry in data.get("varianti") or []:
        code = entry.get("articolo_codice_gestionale") or entry.get("codice") or f"{article}-{entry.get('id')}"
        variants.append({"size": str(entry.get("descr") or "One size").strip(), "color": color, "color_hex": color_hex,
                         "sku": f"LVR-{slugify(str(code)).upper()}", "variant_price": None,
                         "stock": 0 if int(entry.get("articolo_out_of_stock") or 0) else stock})
    return {
        "handle": f"{slugify(title, 70)}-{slugify(article)}",
        "title": title,
        "description": html_to_text(data.get("descr_estesa") or data.get("descr_breve") or ""),
        "category": category_handle(LVR_TYPE_NAMES[kind][lang], gender, lang),
        "price": price,
        "compare_at_price": list_price if list_price > price else None,
        "tags": [t for t in ["luisaviaroma", slugify(brand), slugify(str(category3))] if t],
        "images": images[:MAX_IMAGES],
        "variants": variants or [{"size": "One size", "color": color, "color_hex": color_hex,
                                  "sku": f"LVR-{slugify(article).upper()}", "variant_price": None, "stock": stock}],
    }


def read_lvr_pages(folder: Path, lang: str, stock: int) -> list[dict]:
    files = sorted(folder.glob("*.htm*")) if folder.is_dir() else [folder]
    products = []
    for file in files:
        item = lvr_product(file.read_text(encoding="utf-8", errors="replace"), lang, stock)
        if item:
            products.append(item)
        else:
            log(f"  {file.name}: no product data (save the product page itself, as 'Webpage, HTML only')")
    log(f"Luisaviaroma: {len(products)} products from {len(files)} saved pages")
    return products


# --------------------------------------------------------------------------- CSV


def write_csv(products: list[dict], lang: str, output: Path) -> int:
    seen_handles, seen_skus, rows = set(), set(), 0
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        for item in products:
            if item["handle"] in seen_handles or not item["price"]:
                continue
            seen_handles.add(item["handle"])
            first = True
            for variant in item["variants"]:
                if variant["sku"] in seen_skus:
                    continue
                seen_skus.add(variant["sku"])
                row = {"handle": item["handle"], "variant_price": money(variant["variant_price"]),
                       **{key: variant[key] for key in ("size", "color", "color_hex", "sku", "stock")}}
                if first:  # product fields only on its first row, like the template
                    row.update({
                        f"title_{lang}": item["title"],
                        f"description_{lang}": item["description"],
                        "category": item["category"],
                        "price": money(item["price"]),
                        "compare_at_price": money(item["compare_at_price"]),
                        "status": "active",
                        "featured": "no",
                        "tags": "|".join(dict.fromkeys(t for t in item["tags"] if t)),
                        "image_urls": "|".join(item["images"]),
                    })
                    first = False
                writer.writerow(row)
                rows += 1
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Nike + Luisaviaroma -> products CSV for the store importer.")
    parser.add_argument("--lang", default="it", help="it/italian, en/english, es/spanish (default: it)")
    parser.add_argument("--url", default="https://www.nike.com/it/w", help="Nike page to start from (default: all products)")
    parser.add_argument("--per-category", type=int, default=0, help="max models per category (default: all)")
    parser.add_argument("--limit", type=int, default=0, help="max Nike models in total (default: all)")
    parser.add_argument("--sources", default="nike,lvr", help="comma list: nike, lvr (default: both)")
    parser.add_argument("--lvr-pages", type=Path, default=HERE / "lvr_pages", help="folder of saved Luisaviaroma product pages")
    parser.add_argument("--stock", type=int, default=10, help="stock for sizes that are available (default: 10)")
    parser.add_argument("--workers", type=int, default=8, help="parallel requests (default: 8)")
    parser.add_argument("--output", type=Path, default=HERE / "products-import.csv")
    args = parser.parse_args()

    lang = LANG_ALIASES.get(args.lang.strip().lower())
    if not lang:
        parser.error(f"unknown --lang {args.lang!r}: use it, en or es")
    sources = {s.strip() for s in args.sources.split(",")}

    started = time.time()
    products: list[dict] = []
    if "nike" in sources:
        products += scrape_nike(args.url, lang, args.limit, args.per_category, args.stock, args.workers)
    if "lvr" in sources:
        if args.lvr_pages.exists():
            products += read_lvr_pages(args.lvr_pages, lang, args.stock)
        else:
            log(f"Luisaviaroma: no saved pages in {args.lvr_pages} (see the note at the top of this script)")

    rows = write_csv(products, lang, args.output)
    log(f"Wrote {args.output} ({len(products)} products, {rows} rows, language: {lang}, {time.time() - started:.0f}s)")
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
