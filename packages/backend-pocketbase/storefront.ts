import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { StoreCategory, StoreProductCard, StorefrontBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import { buildFacets, buildProductCard, variantPrice } from "@repo/core/lib/product-cards";
import type { ShopFilters } from "@repo/core/lib/schemas/storefront";
import { parseSeo } from "@repo/core/lib/schemas/seo";
import { createPublicPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import { getFileUrl } from "@repo/backend-pocketbase/files";
import type { CategoriesResponse, ProductsResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

// Public reads with the anonymous client: PocketBase's API rules decide what is visible
// (active, not deleted products; active variants; visible categories).

// Generic order follows the generated type: description, image_colors, tags, title.
type ProductRecord = ProductsResponse<LocalizedText, Record<string, string>, string[], LocalizedText>;
type CategoryRecord = CategoriesResponse<LocalizedText, LocalizedText>;

const CARD_FIELDS = "id,collectionId,slug,title,images,price,compare_at_price,created_at";
const VARIANT_FIELDS = "id,product,size,color,color_hex,price_override,stock,sort_order";

const SORTS: Record<ShopFilters["sort"], string> = {
  featured: "-is_featured,-created_at",
  newest: "-created_at",
  price_asc: "price,-created_at",
  price_desc: "-price,-created_at",
};

function toCategory(record: CategoryRecord): StoreCategory {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name ?? {},
    description: record.description ?? {},
    image_url: record.image ? getFileUrl(record, record.image) : "",
    parent: record.parent,
    seo: parseSeo(record.seo),
  };
}

async function variantsFor(pb: TypedPocketBase, product_ids: string[]) {
  if (product_ids.length === 0) return [];
  return pb.collection("product_variants").getFullList({
    filter: product_ids.map((id, index) => pb.filter(`product = {:p${index}}`, { [`p${index}`]: id })).join(" || "),
    sort: "sort_order,created_at",
    fields: VARIANT_FIELDS,
  });
}

async function toCards(pb: TypedPocketBase, products: ProductRecord[]): Promise<StoreProductCard[]> {
  const variants = await variantsFor(
    pb,
    products.map((product) => product.id),
  );
  return products.map((product) =>
    buildProductCard(
      {
        id: product.id,
        slug: product.slug,
        title: product.title ?? {},
        images: (product.images ?? []).slice(0, 2).map((name) => getFileUrl(product, name)),
        price: product.price,
        compare_at_price: product.compare_at_price,
        created_at: product.created_at,
      },
      variants.filter((variant) => variant.product === product.id),
    ),
  );
}

function buildShopFilter(pb: TypedPocketBase, filters: ShopFilters): string {
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

export const storefront: StorefrontBackend = {
  async shopProducts(filters, page_size) {
    const pb = createPublicPocketBase();
    const result = await pb.collection("products").getList<ProductRecord>(filters.page, page_size, {
      filter: buildShopFilter(pb, filters),
      sort: SORTS[filters.sort],
      fields: CARD_FIELDS,
    });
    return {
      items: await toCards(pb, result.items),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async productCards(query) {
    const pb = createPublicPocketBase();
    const parts: string[] = [];
    if (query.featured_only) parts.push("is_featured = true");
    if (query.exclude_id) parts.push(pb.filter("id != {:id}", { id: query.exclude_id }));
    if (query.category_id) parts.push(pb.filter("category = {:category}", { category: query.category_id }));
    const result = await pb.collection("products").getList<ProductRecord>(1, query.limit, {
      filter: parts.join(" && "),
      sort: SORTS[query.sort],
      fields: CARD_FIELDS,
      skipTotal: true,
    });
    return toCards(pb, result.items);
  },

  async categories() {
    const pb = createPublicPocketBase();
    const categories = await pb.collection("categories").getFullList<CategoryRecord>({ sort: "sort_order,created_at" });
    return categories.map(toCategory);
  },

  async facets() {
    const pb = createPublicPocketBase();
    return buildFacets(await pb.collection("product_variants").getFullList({ fields: "size,color,color_hex" }));
  },

  async product(slug) {
    const pb = createPublicPocketBase();
    const product = await pb
      .collection("products")
      .getFirstListItem<ProductRecord>(pb.filter("slug = {:slug}", { slug }), { expand: "category" })
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
        throw error;
      });
    const variants = await variantsFor(pb, [product.id]);
    const category = (product.expand as { category?: CategoryRecord } | undefined)?.category;

    return {
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
      seo: parseSeo(product.seo),
    };
  },

  async productSlugs() {
    const pb = createPublicPocketBase();
    return pb.collection("products").getFullList({ fields: "slug,updated_at" });
  },
  async productFacts() {
    const pb = createPublicPocketBase();
    const [products, variants] = await Promise.all([
      pb.collection("products").getFullList<ProductRecord>({
        fields: "id,title,tags,category,price,compare_at_price,created_at",
      }),
      pb.collection("product_variants").getFullList({ fields: "product,price_override,stock" }),
    ]);
    return products.map((product) => {
      const own = variants.filter((variant) => variant.product === product.id);
      const prices = own.map((variant) => (variant.price_override > 0 ? variant.price_override : product.price));
      return {
        id: product.id,
        title: Object.values(product.title ?? {})[0] ?? "",
        tags: Array.isArray(product.tags) ? product.tags : [],
        category_id: product.category,
        price: prices.length > 0 ? Math.min(...prices) : product.price,
        compare_at_price: product.compare_at_price,
        in_stock: own.some((variant) => variant.stock > 0),
        created_at: product.created_at,
      };
    });
  },

  async productCardsByIds(ids) {
    if (ids.length === 0) return [];
    const pb = createPublicPocketBase();
    const found: ProductRecord[] = [];
    // Short filters: PocketBase rejects very long ones.
    for (let start = 0; start < ids.length; start += 50) {
      const chunk = ids.slice(start, start + 50);
      found.push(
        ...(await pb.collection("products").getFullList<ProductRecord>({
          filter: chunk.map((id, index) => pb.filter(`id = {:p${index}}`, { [`p${index}`]: id })).join(" || "),
          fields: CARD_FIELDS,
        })),
      );
    }
    const order = new Map(ids.map((id, index) => [id, index]));
    found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return toCards(pb, found);
  },
};
