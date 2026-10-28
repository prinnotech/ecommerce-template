import { SearchIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ShopFilters } from "./components/shop-filters";
import { ShopToolbar } from "./components/shop-toolbar";
import { getShopFacets, getShopProducts, getStoreCategories } from "@/app/actions/storefront";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18nConfig";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { shop_filters_schema, shopQuery, type ShopFilters as Filters } from "@/lib/schemas/storefront";
import { getSiteSettings } from "@/lib/site-settings-server";
import { formatCurrency } from "@/lib/utils/format";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/shop">): Promise<Metadata> {
  const { lang } = await params;
  const filters = shop_filters_schema.parse(await searchParams);
  const [dictionary, categories] = await Promise.all([getDictionary(lang), getStoreCategories()]);
  const category = (categories.ok ? categories.data : []).find((item) => item.slug === filters.category);
  const metadata = await buildPageMetadata({
    lang,
    // Category pages are worth indexing on their own; other filter combinations point at /shop.
    path: category ? `/shop?category=${category.slug}` : "/shop",
    title: category ? localized(category.name, lang as Locale) : dictionary.store.shop.meta_title,
    description: category
      ? localized(category.description, lang as Locale) || dictionary.store.shop.meta_description
      : dictionary.store.shop.meta_description,
  });
  // Search results and deep filter pages shouldn't be indexed.
  const is_filtered = Boolean(
    filters.q || filters.size || filters.color || filters.min || filters.max || filters.in_stock,
  );
  return is_filtered ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function ShopPage({ params, searchParams }: PageProps<"/[lang]/shop">) {
  const { lang } = await params;
  const locale = lang as Locale;
  const filters = shop_filters_schema.parse(await searchParams);
  const [dictionary, settings, products, facets, categories] = await Promise.all([
    getDictionary(lang),
    getSiteSettings(),
    getShopProducts(filters),
    getShopFacets(),
    getStoreCategories(),
  ]);
  const text = dictionary.store.shop;
  const all_categories = categories.ok ? categories.data : [];
  const category = all_categories.find((item) => item.slug === filters.category);
  const base = `/${lang}/shop`;
  const money = (units: number) => formatCurrency(units * 100, settings.CURRENCY, lang);

  const title = filters.q
    ? text.search_title.replace("{query}", filters.q)
    : category
      ? localized(category.name, locale)
      : text.title;
  const description = category ? localized(category.description, locale) : "";

  // One removable chip per active filter.
  const chips: { label: string; patch: Partial<Filters> }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, patch: { q: "" } });
  if (category) chips.push({ label: localized(category.name, locale), patch: { category: "" } });
  if (filters.size) chips.push({ label: `${text.size}: ${filters.size}`, patch: { size: "" } });
  if (filters.color) chips.push({ label: `${text.color}: ${filters.color}`, patch: { color: "" } });
  if (filters.min || filters.max) {
    chips.push({
      label: `${text.price}: ${filters.min ? money(filters.min) : "0"} – ${filters.max ? money(filters.max) : "∞"}`,
      patch: { min: 0, max: 0 },
    });
  }
  if (filters.in_stock) chips.push({ label: text.in_stock, patch: { in_stock: false } });

  const filter_props = {
    lang,
    filters,
    categories: all_categories,
    sizes: facets.ok ? facets.data.sizes : [],
    colors: facets.ok ? facets.data.colors : [],
    currency: settings.CURRENCY,
    dictionary: text,
  };
  const page = products.ok ? products.data : { items: [], page: 1, total_pages: 1, total_items: 0 };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-5xl">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {/* Plain GET form: search works even before JavaScript loads. */}
        <form action={base} role="search" className="relative w-full md:w-72">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            aria-label={text.search_label}
            placeholder={text.search_placeholder}
            className="h-10 pl-9"
          />
        </form>
      </div>

      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ShopFilters {...filter_props} />
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <ShopToolbar
            {...filter_props}
            results_label={text.results.replace("{count}", String(page.total_items))}
            active_filter_count={chips.length}
            close_label={dictionary.common.close}
          />

          {chips.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <Link
                    href={`${base}${shopQuery({ ...filters, page: 1, ...chip.patch })}`}
                    scroll={false}
                    aria-label={text.remove_filter.replace("{name}", chip.label)}
                    className="bg-muted hover:bg-muted/70 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                  >
                    {chip.label}
                    <XIcon className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`${base}${shopQuery({ sort: filters.sort })}`}
                  scroll={false}
                  className="text-muted-foreground hover:text-foreground px-2 text-sm underline-offset-4 hover:underline"
                >
                  {text.clear_all}
                </Link>
              </li>
            </ul>
          )}

          {page.items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <p className="text-muted-foreground">{text.empty}</p>
              {chips.length > 0 && (
                <Button asChild variant="outline">
                  <Link href={base}>{text.empty_cta}</Link>
                </Button>
              )}
            </div>
          ) : (
            <ProductGrid
              products={page.items}
              lang={lang}
              currency={settings.CURRENCY}
              dictionary={dictionary.store.card}
              columns={3}
              priority_count={3}
            />
          )}

          {page.total_pages > 1 && (
            <nav
              className="flex items-center justify-center gap-3 pt-6"
              aria-label={text.page_of
                .replace("{page}", String(page.page))
                .replace("{total}", String(page.total_pages))}
            >
              {page.page > 1 ? (
                <Button asChild variant="outline">
                  <Link href={`${base}${shopQuery({ ...filters, page: page.page - 1 })}`}>{text.previous}</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {text.previous}
                </Button>
              )}
              <span className="text-muted-foreground text-sm">
                {text.page_of.replace("{page}", String(page.page)).replace("{total}", String(page.total_pages))}
              </span>
              {page.page < page.total_pages ? (
                <Button asChild variant="outline">
                  <Link href={`${base}${shopQuery({ ...filters, page: page.page + 1 })}`}>{text.next}</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {text.next}
                </Button>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
