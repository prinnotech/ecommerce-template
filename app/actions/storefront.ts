"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { LocalizedText } from "@/lib/localized";
import { pocketBaseStatus } from "@/lib/pocketbase/errors";
import { getFileUrl } from "@/lib/pocketbase/files";
import { createPublicPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { record_id_schema, slug_schema } from "@/lib/schemas/catalog";
import { shop_filters_schema, type ShopFilters } from "@/lib/schemas/storefront";
import { reportError } from "@/lib/server-log";
import { compareSizes } from "@/lib/size-order";
import type { CategoriesResponse, ProductsResponse, ProductVariantsResponse } from "@/types/pocketbase-types";

// Public storefront reads. They use the anonymous client, so PocketBase's API rules
// decide what is visible (active, not deleted products; active variants; visible categories).

const SHOP_PAGE_SIZE = 24;
const NEW_FOR_DAYS = 30;

type ProductRecord = ProductsResponse<LocalizedText, string[], LocalizedText>;
type CategoryRecord = CategoriesResponse<LocalizedText, LocalizedText>;
type PublicClient = ReturnType<typeof createPublicPocketBase>;

export type StoreColor = { name: string; hex: string };

export type StoreProductCard = {
  id: string;
  slug: string;
  title: LocalizedText;
  image: string;
  hover_image: string;
  // Lowest sellable price (a variant can override the product price).
  price: number;
  has_price_range: boolean;
  compare_at_price: number;
  colors: StoreColor[];
  is_sold_out: boolean;
  created_at: string;
  // Added in the last NEW_FOR_DAYS days ("New" badge).
  is_new: boolean;
};

export type StoreCategory = {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  image_url: string;
  parent: string;
};

export type StoreVariant = {
  id: string;
  size: string;
  color: string;
  color_hex: string;
  price: number;
  stock: number;
};

export type StoreProduct = {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  images: string[];
  price: number;
  compare_at_price: number;
  category: StoreCategory | null;
  variants: StoreVariant[];
  updated_at: string;
};

export type ShopPage = {
  items: StoreProductCard[];
  page: number;
  total_pages: number;
  total_items: number;
};

export type ShopFacets = { sizes: string[]; colors: StoreColor[] };

const CARD_FIELDS = "id,collectionId,slug,title,images,price,compare_at_price,created_at";
const VARIANT_FIELDS = "id,product,size,color,color_hex,price_override,stock,sort_order";

function variantPrice(variant: Pick<ProductVariantsResponse, "price_override">, product_price: number): number {
  return variant.price_override > 0 ? variant.price_override : product_price;
}

function toCategory(record: CategoryRecord): StoreCategory {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name ?? {},
    description: record.description ?? {},
    image_url: record.image ? getFileUrl(record, record.image) : "",
    parent: record.parent,
  };
}

async function variantsFor(pb: PublicClient, product_ids: string[]) {
  if (product_ids.length === 0) return [];
  return pb.collection("product_variants").getFullList({
    filter: product_ids.map((id, index) => pb.filter(`product = {:p${index}}`, { [`p${index}`]: id })).join(" || "),
    sort: "sort_order,created_at",
    fields: VARIANT_FIELDS,
  });
}

async function toCards(pb: PublicClient, products: ProductRecord[]): Promise<StoreProductCard[]> {
  const variants = await variantsFor(
    pb,
    products.map((product) => product.id),
  );
  return products.map((product) => {
    const own = variants.filter((variant) => variant.product === product.id);
    const prices = own.map((variant) => variantPrice(variant, product.price));
    const colors = new Map<string, StoreColor>();
    for (const variant of own) {
      if (variant.color && !colors.has(variant.color.toLowerCase())) {
        colors.set(variant.color.toLowerCase(), { name: variant.color, hex: variant.color_hex });
      }
    }
    const images = product.images ?? [];
    return {
      id: product.id,
      slug: product.slug,
      title: product.title ?? {},
      image: images[0] ? getFileUrl(product, images[0]) : "",
      hover_image: images[1] ? getFileUrl(product, images[1]) : "",
      price: prices.length > 0 ? Math.min(...prices) : product.price,
      has_price_range: new Set(prices).size > 1,
      compare_at_price: product.compare_at_price,
      colors: [...colors.values()],
      // A product without variants can't be added to the cart either.
      is_sold_out: own.every((variant) => variant.stock <= 0),
      created_at: product.created_at,
      is_new: Date.now() - new Date(product.created_at).getTime() < NEW_FOR_DAYS * 86_400_000,
    };
  });
}

function buildShopFilter(pb: PublicClient, filters: ShopFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(pb.filter("(title ~ {:q} || tags ~ {:q} || description ~ {:q})", { q: filters.q }));
  // A parent category includes its subcategories.
  if (filters.category) {
    parts.push(pb.filter("(category.slug = {:c} || category.parent.slug = {:c})", { c: filters.category }));
  }
  if (filters.size) parts.push(pb.filter("product_variants_via_product.size ?= {:size}", { size: filters.size }));
  if (filters.color) parts.push(pb.filter("product_variants_via_product.color ?= {:color}", { color: filters.color }));
  if (filters.in_stock) parts.push("product_variants_via_product.stock ?> 0");
  if (filters.min > 0) parts.push(pb.filter("price >= {:min}", { min: filters.min * 100 }));
  if (filters.max > 0) parts.push(pb.filter("price <= {:max}", { max: filters.max * 100 }));
  return parts.join(" && ");
}

const SORTS: Record<ShopFilters["sort"], string> = {
  featured: "-is_featured,-created_at",
  newest: "-created_at",
  price_asc: "price,-created_at",
  price_desc: "-price,-created_at",
};

export async function getShopProducts(input: Partial<ShopFilters>): Promise<ActionResult<ShopPage>> {
  const filters = shop_filters_schema.parse(input);
  try {
    const pb = createPublicPocketBase();
    const result = await pb.collection("products").getList<ProductRecord>(filters.page, SHOP_PAGE_SIZE, {
      filter: buildShopFilter(pb, filters),
      sort: SORTS[filters.sort],
      fields: CARD_FIELDS,
    });
    return ok({
      items: await toCards(pb, result.items),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    });
  } catch (error) {
    await reportError("storefront", "getShopProducts", error);
    return fail("generic");
  }
}

async function productList(sort: string, filter: string, limit: number): Promise<ActionResult<StoreProductCard[]>> {
  try {
    const pb = createPublicPocketBase();
    const result = await pb.collection("products").getList<ProductRecord>(1, limit, {
      filter,
      sort,
      fields: CARD_FIELDS,
      skipTotal: true,
    });
    return ok(await toCards(pb, result.items));
  } catch (error) {
    await reportError("storefront", "productList", error);
    return fail("generic");
  }
}

export async function getFeaturedProducts(limit = 8): Promise<ActionResult<StoreProductCard[]>> {
  return productList("-created_at", "is_featured = true", Math.min(Math.max(limit, 1), 24));
}

export async function getNewArrivals(limit = 8): Promise<ActionResult<StoreProductCard[]>> {
  return productList("-created_at", "", Math.min(Math.max(limit, 1), 24));
}

export async function getRelatedProducts(
  product_id: string,
  category_id: string,
  limit = 4,
): Promise<ActionResult<StoreProductCard[]>> {
  if (!record_id_schema.safeParse(product_id).success) return ok([]);
  const pb = createPublicPocketBase();
  const filter = record_id_schema.safeParse(category_id).success
    ? pb.filter("id != {:id} && category = {:category}", { id: product_id, category: category_id })
    : pb.filter("id != {:id}", { id: product_id });
  return productList("-is_featured,-created_at", filter, Math.min(Math.max(limit, 1), 12));
}

export async function getStoreCategories(): Promise<ActionResult<StoreCategory[]>> {
  try {
    const pb = createPublicPocketBase();
    const categories = await pb.collection("categories").getFullList<CategoryRecord>({ sort: "sort_order,created_at" });
    return ok(categories.map(toCategory));
  } catch (error) {
    await reportError("storefront", "getStoreCategories", error);
    return fail("generic");
  }
}

// Sizes and colors that exist on sellable variants, for the shop filters.
export async function getShopFacets(): Promise<ActionResult<ShopFacets>> {
  try {
    const pb = createPublicPocketBase();
    const variants = await pb.collection("product_variants").getFullList({ fields: "size,color,color_hex" });
    const sizes = [...new Set(variants.map((variant) => variant.size).filter(Boolean))].sort(compareSizes);
    const colors = new Map<string, StoreColor>();
    for (const variant of variants) {
      if (variant.color && !colors.has(variant.color.toLowerCase())) {
        colors.set(variant.color.toLowerCase(), { name: variant.color, hex: variant.color_hex });
      }
    }
    return ok({ sizes, colors: [...colors.values()].sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (error) {
    await reportError("storefront", "getShopFacets", error);
    return fail("generic");
  }
}

export async function getStoreProduct(slug: string): Promise<ActionResult<StoreProduct>> {
  if (!slug_schema.safeParse(slug).success) return fail("not_found");
  try {
    const pb = createPublicPocketBase();
    const product = await pb
      .collection("products")
      .getFirstListItem<ProductRecord>(pb.filter("slug = {:slug}", { slug }), { expand: "category" });
    const variants = await variantsFor(pb, [product.id]);
    const category = (product.expand as { category?: CategoryRecord } | undefined)?.category;

    return ok({
      id: product.id,
      slug: product.slug,
      title: product.title ?? {},
      description: product.description ?? {},
      images: (product.images ?? []).map((name) => getFileUrl(product, name)),
      price: product.price,
      compare_at_price: product.compare_at_price,
      category: category && category.is_active ? toCategory(category) : null,
      variants: variants.map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        color_hex: variant.color_hex,
        price: variantPrice(variant, product.price),
        stock: variant.stock,
      })),
      updated_at: product.updated_at,
    });
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("storefront", "getStoreProduct", error);
    return fail("generic");
  }
}

// Every active product slug, for the sitemap.
export async function getProductSlugs(): Promise<ActionResult<{ slug: string; updated_at: string }[]>> {
  try {
    const pb = createPublicPocketBase();
    const products = await pb.collection("products").getFullList({ fields: "slug,updated_at" });
    return ok(products);
  } catch (error) {
    await reportError("storefront", "getProductSlugs", error);
    return fail("generic");
  }
}
