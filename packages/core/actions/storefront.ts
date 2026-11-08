"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type {
  AdminCollection,
  Page,
  ProductListQuery,
  ShopFacets,
  StoreCategory,
  StoreColor,
  StoreProduct,
  StoreProductCard,
  StoreVariant,
} from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { collectionProductPage } from "@repo/core/lib/collections-server";
import { record_id_schema, slug_schema } from "@repo/core/lib/schemas/catalog";
import { shop_filters_schema, type ShopFilters } from "@repo/core/lib/schemas/storefront";

// Public storefront reads: no sign-in, and the backend only returns what the public may see
// (active, not deleted products; active variants; visible categories).

const SHOP_PAGE_SIZE = 24;

export type { ShopFacets, StoreCategory, StoreColor, StoreProduct, StoreProductCard, StoreVariant };
export type ShopPage = Page<StoreProductCard>;

export async function getShopProducts(input: Partial<ShopFilters>): Promise<ActionResult<ShopPage>> {
  const filters = shop_filters_schema.parse(input);
  try {
    return ok(await getBackend().storefront.shopProducts(filters, SHOP_PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "storefront", "getShopProducts");
  }
}

async function productList(query: ProductListQuery): Promise<ActionResult<StoreProductCard[]>> {
  try {
    return ok(await getBackend().storefront.productCards(query));
  } catch (error) {
    return failFrom(error, "storefront", "productList");
  }
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 1), max);

export async function getFeaturedProducts(limit = 8): Promise<ActionResult<StoreProductCard[]>> {
  return productList({ sort: "newest", featured_only: true, limit: clamp(limit, 24) });
}

export async function getNewArrivals(limit = 8): Promise<ActionResult<StoreProductCard[]>> {
  return productList({ sort: "newest", limit: clamp(limit, 24) });
}

// A theme's product grid set to one category. An unknown id gives an empty grid.
export async function getCategoryProducts(category_id: string, limit = 8): Promise<ActionResult<StoreProductCard[]>> {
  if (!record_id_schema.safeParse(category_id).success) return ok([]);
  return productList({ sort: "newest", category_id, limit: clamp(limit, 24) });
}

export async function getRelatedProducts(
  product_id: string,
  category_id: string,
  limit = 4,
): Promise<ActionResult<StoreProductCard[]>> {
  if (!record_id_schema.safeParse(product_id).success) return ok([]);
  return productList({
    sort: "featured",
    exclude_id: product_id,
    category_id: record_id_schema.safeParse(category_id).success ? category_id : undefined,
    limit: clamp(limit, 12),
  });
}

export async function getStoreCategories(): Promise<ActionResult<StoreCategory[]>> {
  try {
    return ok(await getBackend().storefront.categories());
  } catch (error) {
    return failFrom(error, "storefront", "getStoreCategories");
  }
}

export async function getShopFacets(): Promise<ActionResult<ShopFacets>> {
  try {
    return ok(await getBackend().storefront.facets());
  } catch (error) {
    return failFrom(error, "storefront", "getShopFacets");
  }
}

export async function getStoreProduct(slug: string): Promise<ActionResult<StoreProduct>> {
  if (!slug_schema.safeParse(slug).success) return fail("not_found");
  try {
    return ok(await getBackend().storefront.product(slug));
  } catch (error) {
    return failFrom(error, "storefront", "getStoreProduct");
  }
}

// Every active product slug, for the sitemap.
export async function getProductSlugs(): Promise<ActionResult<{ slug: string; updated_at: string }[]>> {
  try {
    return ok(await getBackend().storefront.productSlugs());
  } catch (error) {
    return failFrom(error, "storefront", "getProductSlugs");
  }
}

export type StoreCollectionPage = { collection: AdminCollection; products: Page<StoreProductCard> };

const COLLECTION_PAGE_SIZE = 24;

// A published collection and one page of its products (/{lang}/collections/{slug}).
export async function getStoreCollection(slug: string, page = 1): Promise<ActionResult<StoreCollectionPage>> {
  if (!slug_schema.safeParse(slug).success) return fail("not_found");
  try {
    const collection = await getBackend().collections.published(slug);
    if (!collection) return fail("not_found");
    const products = await collectionProductPage(collection, Math.max(1, Math.floor(page) || 1), COLLECTION_PAGE_SIZE);
    return ok({ collection, products });
  } catch (error) {
    return failFrom(error, "storefront", "getStoreCollection");
  }
}

// For a theme's product grid set to a collection.
export async function getCollectionProducts(
  collection_id: string,
  limit = 8,
): Promise<ActionResult<StoreProductCard[]>> {
  if (!record_id_schema.safeParse(collection_id).success) return ok([]);
  try {
    const collection = await getBackend().collections.publishedById(collection_id);
    if (!collection) return ok([]);
    return ok((await collectionProductPage(collection, 1, Math.min(Math.max(limit, 1), 24))).items);
  } catch (error) {
    return failFrom(error, "storefront", "getCollectionProducts");
  }
}

export async function getCollectionSlugs(): Promise<ActionResult<{ slug: string; updated_at: string }[]>> {
  try {
    return ok(await getBackend().collections.publishedSlugs());
  } catch (error) {
    return failFrom(error, "storefront", "getCollectionSlugs");
  }
}
