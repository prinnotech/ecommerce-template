import "server-only";

import type { ExpressionBuilder, SelectQueryBuilder } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { StoreCategory, StoreProductCard, StorefrontBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import { buildFacets, buildProductCard, variantPrice } from "@repo/core/lib/product-cards";
import type { ShopFilters } from "@repo/core/lib/schemas/storefront";
import { parseSeo } from "@repo/core/lib/schemas/seo";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import type { Database } from "@repo/backend-sql/schema";
import { bool, iso, json } from "@repo/backend-sql/values";

// Public reads. The visibility rules are the same as the PocketBase API rules: active, not
// deleted products; active variants; visible categories.

type ProductQuery = SelectQueryBuilder<Database, "products", object>;

export function liveProducts(ctx: SqlContext): ProductQuery {
  return ctx.db.selectFrom("products").where("products.status", "=", "active").where("products.deleted_at", "is", null);
}

export function sellableVariant(eb: ExpressionBuilder<Database, "product_variants">) {
  return eb("product_variants.is_active", "=", true);
}

type CardRow = {
  id: string;
  slug: string;
  title: unknown;
  price: number;
  compare_at_price: number;
  created_at: string;
};

// Image URLs per product, in display order.
export async function imagesFor(
  ctx: SqlContext,
  product_ids: string[],
  width?: number,
): Promise<Map<string, string[]>> {
  const images = new Map<string, string[]>();
  if (product_ids.length === 0) return images;
  const rows = await ctx.db
    .selectFrom("product_images")
    .select(["product_id", "path"])
    .where("product_id", "in", product_ids)
    .orderBy("sort_order")
    .orderBy("created_at")
    .execute();
  for (const row of rows)
    images.set(row.product_id, [...(images.get(row.product_id) ?? []), ctx.storage.url(row.path, width)]);
  return images;
}

async function toCards(ctx: SqlContext, products: CardRow[]): Promise<StoreProductCard[]> {
  const ids = products.map((product) => product.id);
  if (ids.length === 0) return [];
  const [variants, images] = await Promise.all([
    ctx.db
      .selectFrom("product_variants")
      .select(["product_id", "size", "color", "color_hex", "price_override", "stock"])
      .where("product_id", "in", ids)
      .where(sellableVariant)
      .orderBy("sort_order")
      .execute(),
    imagesFor(ctx, ids, 800),
  ]);
  return products.map((product) =>
    buildProductCard(
      {
        id: product.id,
        slug: product.slug,
        title: json<LocalizedText>(product.title, {}),
        images: (images.get(product.id) ?? []).slice(0, 2),
        price: product.price,
        compare_at_price: product.compare_at_price,
        created_at: iso(product.created_at),
      },
      variants.filter((variant) => variant.product_id === product.id),
    ),
  );
}

function toCategory(
  ctx: SqlContext,
  row: {
    id: string;
    slug: string;
    name: unknown;
    description: unknown;
    image: string;
    parent_id: string | null;
    seo: unknown;
  },
): StoreCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: json<LocalizedText>(row.name, {}),
    description: json<LocalizedText>(row.description, {}),
    image_url: row.image ? ctx.storage.url(row.image) : "",
    parent: row.parent_id ?? "",
    seo: parseSeo(json(row.seo, null)),
  };
}

function applyShopFilters(ctx: SqlContext, query: ProductQuery, filters: ShopFilters): ProductQuery {
  let result = query;
  if (filters.q) {
    const q = filters.q;
    result = result.where((eb) =>
      eb.or([
        contains(ctx, "products.title", q),
        contains(ctx, "products.tags", q),
        contains(ctx, "products.description", q),
      ]),
    );
  }
  // A parent category includes its subcategories.
  if (filters.category) {
    const slug = filters.category;
    result = result.where((eb) =>
      eb.exists(
        eb
          .selectFrom("categories as c")
          .leftJoin("categories as parent", "parent.id", "c.parent_id")
          .select("c.id")
          .whereRef("c.id", "=", "products.category_id")
          .where((inner) => inner.or([inner("c.slug", "=", slug), inner("parent.slug", "=", slug)])),
      ),
    );
  }
  const variantMatches = (
    apply: (eb: ExpressionBuilder<Database, "product_variants">) => ReturnType<typeof sellableVariant>,
  ) =>
    result.where((eb) =>
      eb.exists(
        eb
          .selectFrom("product_variants")
          .select("product_variants.id")
          .whereRef("product_variants.product_id", "=", "products.id")
          .where(sellableVariant)
          .where(apply),
      ),
    );
  if (filters.size) {
    const size = filters.size;
    result = variantMatches((eb) => eb("product_variants.size", "=", size));
  }
  if (filters.color) {
    const color = filters.color;
    result = variantMatches((eb) => eb("product_variants.color", "=", color));
  }
  if (filters.in_stock) result = variantMatches((eb) => eb("product_variants.stock", ">", 0));
  if (filters.min > 0) result = result.where("products.price", ">=", filters.min * 100);
  if (filters.max > 0) result = result.where("products.price", "<=", filters.max * 100);
  return result;
}

function sorted(query: ProductQuery, sort: ShopFilters["sort"]) {
  const select = query.select([
    "products.id",
    "products.slug",
    "products.title",
    "products.price",
    "products.compare_at_price",
    "products.created_at",
  ]);
  switch (sort) {
    case "newest":
      return select.orderBy("products.created_at", "desc");
    case "price_asc":
      return select.orderBy("products.price", "asc").orderBy("products.created_at", "desc");
    case "price_desc":
      return select.orderBy("products.price", "desc").orderBy("products.created_at", "desc");
    default:
      return select.orderBy("products.is_featured", "desc").orderBy("products.created_at", "desc");
  }
}

export function createStorefront(ctx: SqlContext): StorefrontBackend {
  const { db } = ctx;
  return {
    async shopProducts(filters, page_size) {
      const query = applyShopFilters(ctx, liveProducts(ctx), filters);
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) => toCards(ctx, await sorted(query, filters.sort).offset(offset).limit(limit).execute()),
      );
    },

    async productCards(query) {
      let products = liveProducts(ctx);
      if (query.featured_only) products = products.where("products.is_featured", "=", true);
      if (query.exclude_id) products = products.where("products.id", "!=", query.exclude_id);
      if (query.category_id) products = products.where("products.category_id", "=", query.category_id);
      const rows = await sorted(products, query.sort === "featured" ? "featured" : "newest")
        .limit(query.limit)
        .execute();
      return toCards(ctx, rows);
    },

    async categories() {
      const rows = await db
        .selectFrom("categories")
        .select(["id", "slug", "name", "description", "image", "parent_id", "seo"])
        .where("is_active", "=", true)
        .orderBy("sort_order")
        .orderBy("created_at")
        .execute();
      return rows.map((row) => toCategory(ctx, row));
    },

    async facets() {
      const variants = await db
        .selectFrom("product_variants")
        .innerJoin("products", "products.id", "product_variants.product_id")
        .select(["product_variants.size", "product_variants.color", "product_variants.color_hex"])
        .where(sellableVariant)
        .where("products.status", "=", "active")
        .where("products.deleted_at", "is", null)
        .execute();
      return buildFacets(variants);
    },

    async product(slug) {
      const product = await liveProducts(ctx)
        .select([
          "products.id",
          "products.slug",
          "products.title",
          "products.description",
          "products.price",
          "products.compare_at_price",
          "products.category_id",
          "products.updated_at",
          "products.seo",
        ])
        .where("products.slug", "=", slug)
        .executeTakeFirst();
      if (!product) throw new BackendError("not_found");

      const [variants, images, category] = await Promise.all([
        db
          .selectFrom("product_variants")
          .select(["id", "size", "color", "color_hex", "price_override", "stock"])
          .where("product_id", "=", product.id)
          .where(sellableVariant)
          .orderBy("sort_order")
          .orderBy("created_at")
          .execute(),
        imagesFor(ctx, [product.id]),
        product.category_id
          ? db
              .selectFrom("categories")
              .select(["id", "slug", "name", "description", "image", "parent_id", "is_active", "seo"])
              .where("id", "=", product.category_id)
              .executeTakeFirst()
          : undefined,
      ]);

      return {
        id: product.id,
        slug: product.slug,
        title: json<LocalizedText>(product.title, {}),
        description: json<LocalizedText>(product.description, {}),
        images: images.get(product.id) ?? [],
        price: product.price,
        compare_at_price: product.compare_at_price,
        category: category && bool(category.is_active) ? toCategory(ctx, category) : null,
        variants: variants.map((variant) => ({
          id: variant.id,
          size: variant.size,
          color: variant.color,
          color_hex: variant.color_hex,
          price: variantPrice(variant, product.price),
          stock: variant.stock,
        })),
        updated_at: iso(product.updated_at),
        seo: parseSeo(json(product.seo, null)),
      };
    },

    async productSlugs() {
      const rows = await liveProducts(ctx).select(["products.slug", "products.updated_at"]).execute();
      return rows.map((row) => ({ slug: row.slug, updated_at: iso(row.updated_at) }));
    },
    async productFacts() {
      const [products, variants] = await Promise.all([
        liveProducts(ctx)
          .select([
            "products.id",
            "products.title",
            "products.tags",
            "products.category_id",
            "products.price",
            "products.compare_at_price",
            "products.created_at",
          ])
          .execute(),
        db
          .selectFrom("product_variants")
          .innerJoin("products", "products.id", "product_variants.product_id")
          .select(["product_variants.product_id", "product_variants.price_override", "product_variants.stock"])
          .where(sellableVariant)
          .where("products.status", "=", "active")
          .where("products.deleted_at", "is", null)
          .execute(),
      ]);
      return products.map((product) => {
        const own = variants.filter((variant) => variant.product_id === product.id);
        const prices = own.map((variant) => (variant.price_override > 0 ? variant.price_override : product.price));
        return {
          id: product.id,
          title: Object.values(json<Record<string, string>>(product.title, {}))[0] ?? "",
          tags: json<string[]>(product.tags, []),
          category_id: product.category_id ?? "",
          price: prices.length > 0 ? Math.min(...prices) : product.price,
          compare_at_price: product.compare_at_price,
          in_stock: own.some((variant) => variant.stock > 0),
          created_at: iso(product.created_at),
        };
      });
    },

    async productCardsByIds(ids) {
      if (ids.length === 0) return [];
      const rows = await liveProducts(ctx)
        .select([
          "products.id",
          "products.slug",
          "products.title",
          "products.price",
          "products.compare_at_price",
          "products.created_at",
        ])
        .where("products.id", "in", ids)
        .execute();
      const order = new Map(ids.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return toCards(ctx, rows);
    },
  };
}
