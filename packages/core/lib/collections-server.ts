import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { AdminCollection, Page, StoreProductCard } from "@repo/core/backend/types";
import { matchesRules, sortProducts, type ProductFacts } from "@repo/core/lib/schemas/collections";

// The live products of a collection, in its sort order: picked by hand (manual) or matching its
// rules (automatic). Hidden or deleted products never show.
export async function collectionProductIds(collection: AdminCollection): Promise<string[]> {
  const facts = await getBackend().storefront.productFacts();
  if (collection.kind === "automatic") {
    return sortProducts(
      facts.filter((product) => matchesRules(collection.rules, product)),
      collection.sort,
    ).map((product) => product.id);
  }
  const by_id = new Map<string, ProductFacts>(facts.map((product) => [product.id, product]));
  const picked = collection.product_ids
    .map((id) => by_id.get(id))
    .filter((product): product is ProductFacts => Boolean(product));
  return (collection.sort === "manual" ? picked : sortProducts(picked, collection.sort)).map((product) => product.id);
}

export async function collectionProductPage(
  collection: AdminCollection,
  page: number,
  page_size: number,
): Promise<Page<StoreProductCard>> {
  const ids = await collectionProductIds(collection);
  const total_pages = Math.max(1, Math.ceil(ids.length / page_size));
  const safe_page = Math.min(Math.max(page, 1), total_pages);
  const items = await getBackend().storefront.productCardsByIds(
    ids.slice((safe_page - 1) * page_size, safe_page * page_size),
  );
  return { items, page: safe_page, total_pages, total_items: ids.length };
}
