import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type {
  AdminCategory,
  AdminProductImage,
  AdminVariant,
  CatalogBackend,
  ImportItemResult,
} from "@repo/core/backend/types";
import { titleCase } from "@repo/core/lib/catalog-import";
import type { LocalizedText } from "@repo/core/lib/localized";
import { MAX_PRODUCT_IMAGES, type ProductListFilters } from "@repo/core/lib/schemas/catalog";
import { parseSeo } from "@repo/core/lib/schemas/seo";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import { getFileUrl } from "@repo/backend-pocketbase/files";
import type { CategoriesResponse, ProductsResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

// Admin catalog work with the superuser client. Callers are authorized in the actions first.

type CategoryRecord = CategoriesResponse<LocalizedText, LocalizedText>;
// Generic order follows the generated type: description, image_colors, tags, title.
type ProductRecord = ProductsResponse<LocalizedText, Record<string, string>, string[], LocalizedText>;

const VARIANT_FIELDS = "id,size,color,color_hex,sku,price_override,stock,is_active,sort_order";
const BATCH_LIMIT = 100; // batch.maxRequests (pb_migrations/1793059200)
const SKU_LOOKUP_SIZE = 50; // PocketBase rejects very long filters

function rethrow(error: unknown, codes: { not_found?: boolean; slug?: boolean }): never {
  if (codes.slug && pocketBaseFieldCode(error, "slug") === "validation_not_unique")
    throw new BackendError("slug_taken");
  if (codes.not_found && pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

function toAdminCategory(record: CategoryRecord, product_count: number): AdminCategory {
  return {
    id: record.id,
    name: record.name ?? {},
    slug: record.slug,
    description: record.description ?? {},
    parent: record.parent,
    sort_order: record.sort_order,
    is_active: record.is_active,
    image_url: record.image ? getFileUrl(record, record.image, "400x400") : "",
    product_count,
    seo: parseSeo(record.seo),
  };
}

// Colors are kept per file name in image_colors (files have no records of their own).
function productImages(
  record: Pick<ProductRecord, "id" | "collectionId" | "images"> & { image_colors?: Record<string, string> | null },
): AdminProductImage[] {
  return (record.images ?? []).map((name) => ({
    name,
    url: getFileUrl(record, name, "400x500"),
    color: record.image_colors?.[name] ?? "",
  }));
}

// The ids that exist and aren't deleted, looked up in filter-sized chunks.
async function liveProductIds(pb: TypedPocketBase, ids: string[]): Promise<string[]> {
  const found: string[] = [];
  for (let start = 0; start < ids.length; start += SKU_LOOKUP_SIZE) {
    const chunk = ids.slice(start, start + SKU_LOOKUP_SIZE);
    const filter = chunk.map((id, index) => pb.filter(`id = {:p${index}}`, { [`p${index}`]: id })).join(" || ");
    const rows = await pb
      .collection("products")
      .getFullList({ filter: `deleted_at = "" && (${filter})`, fields: "id" });
    found.push(...rows.map((row) => row.id));
  }
  return found;
}

// Applies the same change to many products, BATCH_LIMIT requests at a time.
async function updateProducts(pb: TypedPocketBase, ids: string[], fields: Record<string, unknown>): Promise<number> {
  const live = await liveProductIds(pb, ids);
  for (let start = 0; start < live.length; start += BATCH_LIMIT) {
    const batch = pb.createBatch();
    for (const id of live.slice(start, start + BATCH_LIMIT)) batch.collection("products").update(id, fields);
    await batch.send();
  }
  return live.length;
}

// PocketBase filter values must go through pb.filter() placeholders, never string concatenation.
function buildListFilter(pb: TypedPocketBase, filters: ProductListFilters): string {
  const parts = ['deleted_at = ""'];
  if (filters.status !== "all") parts.push(pb.filter("status = {:status}", { status: filters.status }));
  if (filters.category) parts.push(pb.filter("category = {:category}", { category: filters.category }));
  if (filters.search) {
    parts.push(pb.filter("(title ~ {:search} || slug ~ {:search} || tags ~ {:search})", { search: filters.search }));
  }
  return parts.join(" && ");
}

async function liveProduct(pb: TypedPocketBase, id: string, fields: string) {
  const product = await pb
    .collection("products")
    .getOne<ProductRecord>(id, { fields: `${fields},deleted_at` })
    .catch((error: unknown) => rethrow(error, { not_found: true }));
  if (product.deleted_at) throw new BackendError("not_found");
  return product;
}

async function variantsOf(pb: TypedPocketBase, product_id: string): Promise<AdminVariant[]> {
  return pb.collection("product_variants").getFullList({
    filter: pb.filter("product = {:id}", { id: product_id }),
    sort: "sort_order,created_at",
    fields: VARIANT_FIELDS,
  });
}

export const catalog: CatalogBackend = {
  // ---------- Categories ----------

  async listCategories() {
    const pb = await createAdminPocketBase();
    const [categories, products] = await Promise.all([
      pb.collection("categories").getFullList<CategoryRecord>({ sort: "sort_order,created_at" }),
      pb.collection("products").getFullList({ filter: 'deleted_at = "" && category != ""', fields: "category" }),
    ]);
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return categories.map((category) => toAdminCategory(category, counts.get(category.id) ?? 0));
  },

  async createCategory(fields) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("categories")
      .create(fields)
      .catch((error: unknown) => rethrow(error, { slug: true }));
    return { id: record.id };
  },

  async updateCategory(id, fields) {
    const pb = await createAdminPocketBase();
    await pb
      .collection("categories")
      .update(id, fields)
      .catch((error: unknown) => rethrow(error, { slug: true, not_found: true }));
  },

  async deleteCategory(id) {
    const pb = await createAdminPocketBase();
    // Soft-deleted products don't count; PocketBase clears their optional relation on delete.
    const [products, children] = await Promise.all([
      pb
        .collection("products")
        .getList(1, 1, { filter: pb.filter('category = {:id} && deleted_at = ""', { id }), fields: "id" }),
      pb.collection("categories").getList(1, 1, { filter: pb.filter("parent = {:id}", { id }), fields: "id" }),
    ]);
    if (products.totalItems > 0 || children.totalItems > 0) throw new BackendError("category_in_use");
    await pb
      .collection("categories")
      .delete(id)
      .catch((error: unknown) => rethrow(error, { not_found: true }));
  },

  async setCategoryImage(id, file) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("categories")
      .update<CategoryRecord>(id, { image: file })
      .catch((error: unknown) => rethrow(error, { not_found: true }));
    return { image_url: getFileUrl(record, record.image, "400x400") };
  },

  async removeCategoryImage(id) {
    const pb = await createAdminPocketBase();
    await pb
      .collection("categories")
      .update(id, { image: null })
      .catch((error: unknown) => rethrow(error, { not_found: true }));
  },

  // ---------- Products ----------

  async listProducts(filters, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("products").getList<ProductRecord>(filters.page, page_size, {
      filter: buildListFilter(pb, filters),
      // id breaks ties so pages never repeat or skip rows.
      sort: `${filters.direction === "desc" ? "-" : ""}${filters.sort},id`,
      fields: "id,collectionId,title,slug,status,price,compare_at_price,category,images,updated_at",
    });

    const ids = result.items.map((item) => item.id);
    const variants =
      ids.length > 0
        ? await pb.collection("product_variants").getFullList({
            filter: ids.map((id, index) => pb.filter(`product = {:p${index}}`, { [`p${index}`]: id })).join(" || "),
            fields: "product,stock",
          })
        : [];
    const stock = new Map<string, { count: number; total: number }>();
    for (const variant of variants) {
      const entry = stock.get(variant.product) ?? { count: 0, total: 0 };
      stock.set(variant.product, { count: entry.count + 1, total: entry.total + variant.stock });
    }

    return {
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title ?? {},
        slug: item.slug,
        status: item.status,
        price: item.price,
        compare_at_price: item.compare_at_price,
        category_id: item.category,
        image_url: item.images?.[0] ? getFileUrl(item, item.images[0], "100x100") : "",
        variant_count: stock.get(item.id)?.count ?? 0,
        total_stock: stock.get(item.id)?.total ?? 0,
        updated_at: item.updated_at,
      })),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async getProduct(id) {
    const pb = await createAdminPocketBase();
    const [record, variants] = await Promise.all([
      pb
        .collection("products")
        .getOne<ProductRecord>(id)
        .catch((error: unknown) => rethrow(error, { not_found: true })),
      variantsOf(pb, id),
    ]);
    if (record.deleted_at) throw new BackendError("not_found");
    return {
      id: record.id,
      title: record.title ?? {},
      description: record.description ?? {},
      slug: record.slug,
      category: record.category,
      price: record.price,
      compare_at_price: record.compare_at_price,
      status: record.status,
      is_featured: record.is_featured,
      is_gift_card: record.is_gift_card,
      tags: Array.isArray(record.tags) ? record.tags : [],
      seo: parseSeo(record.seo),
      images: productImages(record),
      variants,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  },

  async createProduct(fields) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("products")
      .create(fields)
      .catch((error: unknown) => rethrow(error, { slug: true }));
    return { id: record.id, slug: record.slug };
  },

  async updateProduct(id, fields) {
    const pb = await createAdminPocketBase();
    const existing = await liveProduct(pb, id, "status,price");
    await pb
      .collection("products")
      .update(id, fields)
      .catch((error: unknown) => rethrow(error, { slug: true, not_found: true }));
    return { status: existing.status, price: existing.price };
  },

  async deleteProduct(id) {
    const pb = await createAdminPocketBase();
    await pb
      .collection("products")
      .update(id, { deleted_at: new Date().toISOString(), status: "archived" })
      .catch((error: unknown) => rethrow(error, { not_found: true }));
  },

  async saveVariants(product_id, variants) {
    const pb = await createAdminPocketBase();
    await liveProduct(pb, product_id, "id");

    const existing = await pb.collection("product_variants").getFullList({
      filter: pb.filter("product = {:id}", { id: product_id }),
      fields: "id",
    });
    const existing_ids = new Set(existing.map((variant) => variant.id));
    // An id that isn't one of this product's variants is refused, not silently re-parented.
    if (variants.some((variant) => variant.id && !existing_ids.has(variant.id)))
      throw new BackendError("invalid_input");
    const kept_ids = new Set(variants.map((variant) => variant.id).filter(Boolean));

    const batch = pb.createBatch();
    for (const id of existing_ids) {
      if (!kept_ids.has(id)) batch.collection("product_variants").delete(id);
    }
    variants.forEach((variant, index) => {
      const { id, ...fields } = variant;
      const row = { ...fields, sku: fields.sku.toUpperCase(), product: product_id, sort_order: index };
      if (id) batch.collection("product_variants").update(id, row);
      else batch.collection("product_variants").create(row);
    });
    try {
      await batch.send();
    } catch (error) {
      // The batch reports field errors per request; a unique-index clash means a SKU used by another product.
      if (JSON.stringify((error as { response?: unknown })?.response ?? "").includes("validation_not_unique")) {
        throw new BackendError("sku_taken");
      }
      throw error;
    }
    return variantsOf(pb, product_id);
  },

  async addProductImage(product_id, file) {
    const pb = await createAdminPocketBase();
    const current = await liveProduct(pb, product_id, "images");
    if ((current.images ?? []).length >= MAX_PRODUCT_IMAGES) throw new BackendError("too_many_images");
    const record = await pb.collection("products").update<ProductRecord>(product_id, { "images+": file });
    return productImages(record);
  },

  async removeProductImage(product_id, image) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("products")
      .update<ProductRecord>(product_id, { "images-": [image] })
      .catch((error: unknown) => rethrow(error, { not_found: true }));
    return productImages(record);
  },

  async setProductsStatus(ids, status) {
    return updateProducts(await createAdminPocketBase(), ids, { status });
  },

  async setProductsCategory(ids, category_id) {
    return updateProducts(await createAdminPocketBase(), ids, { category: category_id });
  },

  async deleteProducts(ids) {
    return updateProducts(await createAdminPocketBase(), ids, {
      deleted_at: new Date().toISOString(),
      status: "archived",
    });
  },

  async setImageColor(product_id, image, color) {
    const pb = await createAdminPocketBase();
    const current = await liveProduct(pb, product_id, "images,image_colors");
    const files: string[] = current.images ?? [];
    if (!files.includes(image)) throw new BackendError("not_found");
    // Keep entries only for files that still exist (removed images leave theirs behind).
    const image_colors = Object.fromEntries(
      Object.entries({ ...(current.image_colors ?? {}), [image]: color }).filter(
        ([name, value]) => value && files.includes(name),
      ),
    );
    const record = await pb.collection("products").update<ProductRecord>(product_id, { image_colors });
    return productImages(record);
  },

  async moveCategories(moves) {
    const pb = await createAdminPocketBase();
    for (let start = 0; start < moves.length; start += BATCH_LIMIT) {
      const batch = pb.createBatch();
      for (const move of moves.slice(start, start + BATCH_LIMIT)) {
        batch.collection("categories").update(move.id, { parent: move.parent_id, sort_order: move.sort_order });
      }
      await batch.send().catch((error: unknown) => rethrow(error, { not_found: true }));
    }
  },

  async reorderProductImages(product_id, images) {
    const pb = await createAdminPocketBase();
    const current = await pb
      .collection("products")
      .getOne<ProductRecord>(product_id, { fields: "images" })
      .catch((error: unknown) => rethrow(error, { not_found: true }));
    // Same files, different order only: a reorder must never delete or add images.
    if (JSON.stringify([...images].sort()) !== JSON.stringify([...(current.images ?? [])].sort())) {
      throw new BackendError("invalid_input");
    }
    const record = await pb.collection("products").update<ProductRecord>(product_id, { images });
    return productImages(record);
  },

  // ---------- CSV import ----------

  async categoryIdsBySlug() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("categories").getFullList({ fields: "id,slug" });
    return new Map(records.map((record) => [record.slug, record.id]));
  },

  async importProduct(item, category_id, options): Promise<ImportItemResult> {
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("products")
      .getFirstListItem(pb.filter('slug = {:slug} && deleted_at = ""', { slug: item.handle }), { fields: "id,images" })
      .catch(() => null);
    if (existing && !options.update_existing) return { handle: item.handle, outcome: "skipped", reason: "exists" };

    // A SKU owned by another product would make the variant batch fail halfway: refuse up front.
    const skus = item.variants.map((variant) => variant.sku);
    const owned: { id: string; sku: string; product: string }[] = [];
    for (let start = 0; start < skus.length; start += SKU_LOOKUP_SIZE) {
      const sku_filter = skus
        .slice(start, start + SKU_LOOKUP_SIZE)
        .map((sku, index) => pb.filter(`sku = {:s${index}}`, { [`s${index}`]: sku }))
        .join(" || ");
      owned.push(
        ...(await pb.collection("product_variants").getFullList({ filter: sku_filter, fields: "id,sku,product" })),
      );
    }
    if (owned.some((variant) => variant.product !== existing?.id)) {
      return { handle: item.handle, outcome: "failed", reason: "sku_taken" };
    }

    const fields = {
      slug: item.handle,
      title: item.title,
      description: item.description,
      category: category_id,
      price: item.price,
      compare_at_price: item.compare_at_price,
      status: item.status,
      is_featured: item.is_featured,
      tags: item.tags,
    };
    const product = existing
      ? await pb.collection("products").update(existing.id, fields)
      : await pb.collection("products").create(fields);

    // Upsert by SKU; variants already on the product but not in the file are kept.
    const by_sku = new Map(owned.map((variant) => [variant.sku, variant.id]));
    for (let start = 0; start < item.variants.length; start += BATCH_LIMIT) {
      const batch = pb.createBatch();
      item.variants.slice(start, start + BATCH_LIMIT).forEach((variant, offset) => {
        const row = { ...variant, product: product.id, is_active: true, sort_order: start + offset };
        const id = by_sku.get(variant.sku);
        if (id) batch.collection("product_variants").update(id, row);
        else batch.collection("product_variants").create(row);
      });
      await batch.send();
    }

    // Images only for products without any, so re-importing never duplicates them.
    let images = 0;
    let images_failed = false;
    if (options.loadImages && item.image_urls.length > 0 && (existing?.images ?? []).length === 0) {
      const files = await options.loadImages();
      images = files.length;
      images_failed = files.length < item.image_urls.length;
      if (files.length > 0) await pb.collection("products").update(product.id, { images: files });
    }

    return {
      handle: item.handle,
      outcome: existing ? "updated" : "created",
      reason: images_failed ? "images_failed" : undefined,
      images,
    };
  },

  async importCategory(category, parent_id, update_existing) {
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("categories")
      .getFirstListItem(pb.filter("slug = {:slug}", { slug: category.handle }), { fields: "id" })
      .catch(() => null);
    if (existing && !update_existing) return { handle: category.handle, outcome: "skipped", reason: "exists" };

    const fields = {
      slug: category.handle,
      name: Object.values(category.name).some(Boolean)
        ? category.name
        : { en: titleCase(category.handle), es: titleCase(category.handle), it: titleCase(category.handle) },
      description: category.description,
      parent: parent_id,
      sort_order: category.sort_order,
      is_active: category.is_active,
    };
    const record = existing
      ? await pb.collection("categories").update(existing.id, fields)
      : await pb.collection("categories").create(fields);
    return { handle: category.handle, outcome: existing ? "updated" : "created", id: record.id };
  },
};
