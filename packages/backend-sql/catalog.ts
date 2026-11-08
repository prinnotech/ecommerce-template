import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminProductImage, AdminVariant, CatalogBackend, ImportItemResult } from "@repo/core/backend/types";
import { titleCase } from "@repo/core/lib/catalog-import";
import type { LocalizedText } from "@repo/core/lib/localized";
import { MAX_PRODUCT_IMAGES, type ProductListFilters, type ProductStatus } from "@repo/core/lib/schemas/catalog";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";
import { parseSeo } from "@repo/core/lib/schemas/seo";

// Admin catalog work. Callers are authorized in the actions first.

const VARIANT_COLUMNS = [
  "id",
  "size",
  "color",
  "color_hex",
  "sku",
  "price_override",
  "stock",
  "is_active",
  "sort_order",
] as const;
const SKU_LOOKUP_SIZE = 200;

function slugTaken(error: unknown): never {
  if (uniqueViolation(error)?.includes("slug")) throw new BackendError("slug_taken");
  throw error;
}

export function createCatalog(ctx: SqlContext): CatalogBackend {
  const { db, storage } = ctx;

  async function liveProduct(id: string) {
    const product = await db
      .selectFrom("products")
      .select(["id", "status", "price", "deleted_at"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!product || product.deleted_at) throw new BackendError("not_found");
    return product;
  }

  async function imagesOf(product_id: string): Promise<AdminProductImage[]> {
    const rows = await db
      .selectFrom("product_images")
      .select(["id", "path", "color"])
      .where("product_id", "=", product_id)
      .orderBy("sort_order")
      .orderBy("created_at")
      .execute();
    return rows.map((row) => ({ name: row.id, url: storage.url(row.path, 400), color: row.color }));
  }

  async function variantsOf(product_id: string): Promise<AdminVariant[]> {
    const rows = await db
      .selectFrom("product_variants")
      .select([...VARIANT_COLUMNS])
      .where("product_id", "=", product_id)
      .orderBy("sort_order")
      .orderBy("created_at")
      .execute();
    return rows.map((row) => ({ ...row, is_active: bool(row.is_active) }));
  }

  async function addImages(product_id: string, files: File[]) {
    const count = toCount(
      await db
        .selectFrom("product_images")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("product_id", "=", product_id)
        .executeTakeFirst(),
    );
    let order = count;
    for (const file of files) {
      const path = await storage.upload(`products/${product_id}`, file);
      await db.insertInto("product_images").values({ id: newId(), product_id, path, sort_order: order++ }).execute();
    }
  }

  return {
    // ---------- Categories ----------

    async listCategories() {
      const [categories, counts] = await Promise.all([
        db.selectFrom("categories").selectAll().orderBy("sort_order").orderBy("created_at").execute(),
        db
          .selectFrom("products")
          .select(["category_id", (eb) => eb.fn.countAll().as("count")])
          .where("deleted_at", "is", null)
          .where("category_id", "is not", null)
          .groupBy("category_id")
          .execute(),
      ]);
      const by_category = new Map(counts.map((row) => [row.category_id, Number(row.count)]));
      return categories.map((category) => ({
        id: category.id,
        name: json<LocalizedText>(category.name, {}),
        slug: category.slug,
        description: json<LocalizedText>(category.description, {}),
        parent: category.parent_id ?? "",
        sort_order: category.sort_order,
        is_active: bool(category.is_active),
        image_url: category.image ? storage.url(category.image, 400) : "",
        product_count: by_category.get(category.id) ?? 0,
        seo: parseSeo(json(category.seo, null)),
      }));
    },

    async createCategory(fields) {
      const id = newId();
      await db
        .insertInto("categories")
        .values({ id, ...fields, parent_id: fields.parent || null })
        .execute()
        .catch(slugTaken);
      return { id };
    },

    async updateCategory(id, fields) {
      const { parent, ...rest } = fields;
      const result = await db
        .updateTable("categories")
        .set({ ...rest, parent_id: parent || null, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst()
        .catch(slugTaken);
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async deleteCategory(id) {
      const [products, children] = await Promise.all([
        db
          .selectFrom("products")
          .select("id")
          .where("category_id", "=", id)
          .where("deleted_at", "is", null)
          .limit(1)
          .executeTakeFirst(),
        db.selectFrom("categories").select("id").where("parent_id", "=", id).limit(1).executeTakeFirst(),
      ]);
      if (products || children) throw new BackendError("category_in_use");
      const category = await db.selectFrom("categories").select("image").where("id", "=", id).executeTakeFirst();
      if (!category) throw new BackendError("not_found");
      await db.deleteFrom("categories").where("id", "=", id).execute();
      if (category.image) await storage.remove([category.image]);
    },

    async setCategoryImage(id, file) {
      const category = await db.selectFrom("categories").select("image").where("id", "=", id).executeTakeFirst();
      if (!category) throw new BackendError("not_found");
      const path = await storage.upload(`categories/${id}`, file);
      await db.updateTable("categories").set({ image: path, updated_at: nowIso() }).where("id", "=", id).execute();
      if (category.image) await storage.remove([category.image]);
      return { image_url: storage.url(path, 400) };
    },

    async removeCategoryImage(id) {
      const category = await db.selectFrom("categories").select("image").where("id", "=", id).executeTakeFirst();
      if (!category) throw new BackendError("not_found");
      await db.updateTable("categories").set({ image: "", updated_at: nowIso() }).where("id", "=", id).execute();
      if (category.image) await storage.remove([category.image]);
    },

    // ---------- Products ----------

    async listProducts(filters: ProductListFilters, page_size) {
      let query = db.selectFrom("products").where("deleted_at", "is", null);
      if (filters.status !== "all") query = query.where("status", "=", filters.status);
      if (filters.category) query = query.where("category_id", "=", filters.category);
      if (filters.search) {
        const search = filters.search;
        query = query.where((eb) =>
          eb.or([
            contains(ctx, "products.title", search),
            contains(ctx, "products.slug", search),
            contains(ctx, "products.tags", search),
          ]),
        );
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) => {
          const rows = await query
            .select(["id", "title", "slug", "status", "price", "compare_at_price", "category_id", "updated_at"])
            .orderBy(filters.sort, filters.direction)
            // A stable order between pages when the sort column ties.
            .orderBy("id")
            .offset(offset)
            .limit(limit)
            .execute();
          const ids = rows.map((row) => row.id);
          const [stock, images] = await Promise.all([
            ids.length > 0
              ? db
                  .selectFrom("product_variants")
                  .select(["product_id", (eb) => eb.fn.countAll().as("count"), (eb) => eb.fn.sum("stock").as("total")])
                  .where("product_id", "in", ids)
                  .groupBy("product_id")
                  .execute()
              : [],
            ids.length > 0
              ? db
                  .selectFrom("product_images")
                  .select(["product_id", "path", "sort_order"])
                  .where("product_id", "in", ids)
                  .orderBy("sort_order")
                  .execute()
              : [],
          ]);
          return rows.map((row) => {
            const variants = stock.find((entry) => entry.product_id === row.id);
            const image = images.find((entry) => entry.product_id === row.id);
            return {
              id: row.id,
              title: json<LocalizedText>(row.title, {}),
              slug: row.slug,
              status: row.status as ProductStatus,
              price: row.price,
              compare_at_price: row.compare_at_price,
              category_id: row.category_id ?? "",
              image_url: image ? storage.url(image.path, 100) : "",
              variant_count: Number(variants?.count ?? 0),
              total_stock: Number(variants?.total ?? 0),
              updated_at: iso(row.updated_at),
            };
          });
        },
      );
    },

    async getProduct(id) {
      const product = await db.selectFrom("products").selectAll().where("id", "=", id).executeTakeFirst();
      if (!product || product.deleted_at) throw new BackendError("not_found");
      const [images, variants] = await Promise.all([imagesOf(id), variantsOf(id)]);
      return {
        id: product.id,
        title: json<LocalizedText>(product.title, {}),
        description: json<LocalizedText>(product.description, {}),
        slug: product.slug,
        category: product.category_id ?? "",
        price: product.price,
        compare_at_price: product.compare_at_price,
        status: product.status as ProductStatus,
        is_featured: bool(product.is_featured),
        is_gift_card: bool(product.is_gift_card),
        tags: json<string[]>(product.tags, []),
        seo: parseSeo(json(product.seo, null)),
        images,
        variants,
        created_at: iso(product.created_at),
        updated_at: iso(product.updated_at),
      };
    },

    async createProduct(fields) {
      const id = newId();
      const { category, ...rest } = fields;
      await db
        .insertInto("products")
        .values({ id, ...rest, category_id: category || null })
        .execute()
        .catch(slugTaken);
      return { id, slug: fields.slug };
    },

    async updateProduct(id, fields) {
      const existing = await liveProduct(id);
      const { category, ...rest } = fields;
      await db
        .updateTable("products")
        .set({ ...rest, category_id: category || null, updated_at: nowIso() })
        .where("id", "=", id)
        .execute()
        .catch(slugTaken);
      return { status: existing.status as ProductStatus, price: existing.price };
    },

    async deleteProduct(id) {
      const result = await db
        .updateTable("products")
        .set({ deleted_at: nowIso(), status: "archived", updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async setProductsStatus(ids, status) {
      const result = await db
        .updateTable("products")
        .set({ status, updated_at: nowIso() })
        .where("id", "in", ids)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    },

    async setProductsCategory(ids, category_id) {
      const result = await db
        .updateTable("products")
        .set({ category_id: category_id || null, updated_at: nowIso() })
        .where("id", "in", ids)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    },

    async deleteProducts(ids) {
      const result = await db
        .updateTable("products")
        .set({ deleted_at: nowIso(), status: "archived", updated_at: nowIso() })
        .where("id", "in", ids)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    },

    async saveVariants(product_id, variants) {
      await liveProduct(product_id);
      const existing = await db
        .selectFrom("product_variants")
        .select("id")
        .where("product_id", "=", product_id)
        .execute();
      const existing_ids = new Set(existing.map((variant) => variant.id));
      // An id that isn't one of this product's variants is refused, not silently re-parented.
      if (variants.some((variant) => variant.id && !existing_ids.has(variant.id)))
        throw new BackendError("invalid_input");
      const kept_ids = variants.map((variant) => variant.id).filter(Boolean);

      try {
        await db.transaction().execute(async (trx) => {
          const removed = [...existing_ids].filter((id) => !kept_ids.includes(id));
          if (removed.length > 0) await trx.deleteFrom("product_variants").where("id", "in", removed).execute();
          for (const [index, variant] of variants.entries()) {
            const { id, ...fields } = variant;
            const row = { ...fields, sku: fields.sku.toUpperCase(), sort_order: index };
            if (id)
              await trx
                .updateTable("product_variants")
                .set({ ...row, updated_at: nowIso() })
                .where("id", "=", id)
                .execute();
            else
              await trx
                .insertInto("product_variants")
                .values({ id: newId(), product_id, ...row })
                .execute();
          }
        });
      } catch (error) {
        if (uniqueViolation(error)?.includes("sku")) throw new BackendError("sku_taken");
        throw error;
      }
      return variantsOf(product_id);
    },

    async addProductImage(product_id, file) {
      await liveProduct(product_id);
      const current = await imagesOf(product_id);
      if (current.length >= MAX_PRODUCT_IMAGES) throw new BackendError("too_many_images");
      await addImages(product_id, [file]);
      return imagesOf(product_id);
    },

    async removeProductImage(product_id, image) {
      const row = await db
        .selectFrom("product_images")
        .select(["id", "path"])
        .where("id", "=", image)
        .where("product_id", "=", product_id)
        .executeTakeFirst();
      if (!row) throw new BackendError("not_found");
      await db.deleteFrom("product_images").where("id", "=", row.id).execute();
      await storage.remove([row.path]);
      return imagesOf(product_id);
    },

    async reorderProductImages(product_id, images) {
      const current = await imagesOf(product_id);
      // Same images, different order only: a reorder must never delete or add images.
      if (JSON.stringify([...images].sort()) !== JSON.stringify(current.map((image) => image.name).sort())) {
        throw new BackendError("invalid_input");
      }
      await db.transaction().execute(async (trx) => {
        for (const [index, id] of images.entries()) {
          await trx.updateTable("product_images").set({ sort_order: index }).where("id", "=", id).execute();
        }
      });
      return imagesOf(product_id);
    },

    async setImageColor(product_id, image, color) {
      await liveProduct(product_id);
      const result = await db
        .updateTable("product_images")
        .set({ color, updated_at: nowIso() })
        .where("id", "=", image)
        .where("product_id", "=", product_id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
      return imagesOf(product_id);
    },

    async moveCategories(moves) {
      await db.transaction().execute(async (trx) => {
        for (const move of moves) {
          const result = await trx
            .updateTable("categories")
            .set({ parent_id: move.parent_id || null, sort_order: move.sort_order, updated_at: nowIso() })
            .where("id", "=", move.id)
            .executeTakeFirst();
          if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
        }
      });
    },

    // ---------- CSV import ----------

    async categoryIdsBySlug() {
      const rows = await db.selectFrom("categories").select(["id", "slug"]).execute();
      return new Map(rows.map((row) => [row.slug, row.id]));
    },

    async importProduct(item, category_id, options): Promise<ImportItemResult> {
      const existing = await db
        .selectFrom("products")
        .select("id")
        .where("slug", "=", item.handle)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      if (existing && !options.update_existing) return { handle: item.handle, outcome: "skipped", reason: "exists" };

      // A SKU owned by another product would fail the transaction halfway: refuse up front.
      const skus = item.variants.map((variant) => variant.sku);
      const owned: { id: string; sku: string; product_id: string }[] = [];
      for (let start = 0; start < skus.length; start += SKU_LOOKUP_SIZE) {
        owned.push(
          ...(await db
            .selectFrom("product_variants")
            .select(["id", "sku", "product_id"])
            .where("sku", "in", skus.slice(start, start + SKU_LOOKUP_SIZE))
            .execute()),
        );
      }
      if (owned.some((variant) => variant.product_id !== existing?.id)) {
        return { handle: item.handle, outcome: "failed", reason: "sku_taken" };
      }

      const fields = {
        slug: item.handle,
        title: item.title,
        description: item.description,
        category_id: category_id || null,
        price: item.price,
        compare_at_price: item.compare_at_price,
        status: item.status,
        is_featured: item.is_featured,
        tags: item.tags,
      };
      const product_id = existing?.id ?? newId();
      const by_sku = new Map(owned.map((variant) => [variant.sku, variant.id]));
      await db.transaction().execute(async (trx) => {
        if (existing)
          await trx
            .updateTable("products")
            .set({ ...fields, updated_at: nowIso() })
            .where("id", "=", product_id)
            .execute();
        else
          await trx
            .insertInto("products")
            .values({ id: product_id, ...fields })
            .execute();
        // Upsert by SKU; variants already on the product but not in the file are kept.
        for (const [index, variant] of item.variants.entries()) {
          const row = { ...variant, is_active: true, sort_order: index };
          const id = by_sku.get(variant.sku);
          if (id)
            await trx
              .updateTable("product_variants")
              .set({ ...row, updated_at: nowIso() })
              .where("id", "=", id)
              .execute();
          else
            await trx
              .insertInto("product_variants")
              .values({ id: newId(), product_id, ...row })
              .execute();
        }
      });

      // Images only for products without any, so re-importing never duplicates them.
      let images = 0;
      let images_failed = false;
      const has_images = existing ? (await imagesOf(product_id)).length > 0 : false;
      if (options.loadImages && item.image_urls.length > 0 && !has_images) {
        const files = await options.loadImages();
        images = files.length;
        images_failed = files.length < item.image_urls.length;
        await addImages(product_id, files);
      }

      return {
        handle: item.handle,
        outcome: existing ? "updated" : "created",
        reason: images_failed ? "images_failed" : undefined,
        images,
      };
    },

    async importCategory(category, parent_id, update_existing) {
      const existing = await db
        .selectFrom("categories")
        .select("id")
        .where("slug", "=", category.handle)
        .executeTakeFirst();
      if (existing && !update_existing) return { handle: category.handle, outcome: "skipped", reason: "exists" };
      const name = Object.values(category.name).some(Boolean)
        ? category.name
        : { en: titleCase(category.handle), es: titleCase(category.handle), it: titleCase(category.handle) };
      const fields = {
        slug: category.handle,
        name,
        description: category.description,
        parent_id: parent_id || null,
        sort_order: category.sort_order,
        is_active: category.is_active,
      };
      const id = existing?.id ?? newId();
      if (existing)
        await db
          .updateTable("categories")
          .set({ ...fields, updated_at: nowIso() })
          .where("id", "=", id)
          .execute();
      else
        await db
          .insertInto("categories")
          .values({ id, ...fields })
          .execute();
      return { handle: category.handle, outcome: existing ? "updated" : "created", id };
    },
  };
}
