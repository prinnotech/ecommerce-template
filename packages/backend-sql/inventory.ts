import "server-only";

import { sql, type Kysely } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { InventoryAdjustmentEntry, InventoryBackend, InventoryRow } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { AdjustmentReason } from "@repo/core/lib/schemas/inventory";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import type { Database } from "@repo/backend-sql/schema";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

// Changes a variant's stock by `delta` inside the caller's transaction and logs it, so orders,
// restocks and the Inventory screen all leave the same history. Variants that no longer exist are skipped.
export async function changeStockLogged(
  trx: Kysely<Database>,
  variant_id: string,
  delta: number,
  log: { reason: AdjustmentReason; note: string; actor_id: string },
): Promise<void> {
  const updated = await trx
    .updateTable("product_variants")
    .set({ stock: sql`stock + ${delta}`, updated_at: nowIso() })
    .where("id", "=", variant_id)
    .executeTakeFirst();
  if (Number(updated.numUpdatedRows) === 0) return;
  const variant = await trx
    .selectFrom("product_variants")
    .select("stock")
    .where("id", "=", variant_id)
    .executeTakeFirst();
  await trx
    .insertInto("inventory_adjustments")
    .values({
      id: newId(),
      variant_id,
      delta,
      stock_after: variant?.stock ?? 0,
      reason: log.reason,
      note: log.note,
      actor_id: log.actor_id || null,
    })
    .execute();
}

export function createInventory(ctx: SqlContext): InventoryBackend {
  const { db, storage } = ctx;

  return {
    async list(filters, low_stock_threshold, page_size) {
      let query = db
        .selectFrom("product_variants")
        .innerJoin("products", "products.id", "product_variants.product_id")
        .where("products.deleted_at", "is", null);
      if (filters.stock === "low") {
        query = query
          .where("product_variants.stock", ">", 0)
          .where("product_variants.stock", "<=", low_stock_threshold);
      }
      if (filters.stock === "out") query = query.where("product_variants.stock", "<=", 0);
      if (filters.category) query = query.where("products.category_id", "=", filters.category);
      if (filters.search) {
        const search = filters.search;
        query = query.where((eb) =>
          eb.or([
            contains(ctx, "products.title", search),
            contains(ctx, "product_variants.sku", search),
            contains(ctx, "product_variants.color", search),
            contains(ctx, "product_variants.size", search),
          ]),
        );
      }

      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) => {
          const rows = await query
            .select([
              "product_variants.id",
              "product_variants.product_id",
              "products.title",
              "product_variants.sku",
              "product_variants.size",
              "product_variants.color",
              "product_variants.stock",
              "product_variants.is_active",
            ])
            .orderBy("products.updated_at", "desc")
            .orderBy("products.id")
            .orderBy("product_variants.sort_order")
            .orderBy("product_variants.id")
            .offset(offset)
            .limit(limit)
            .execute();
          const product_ids = [...new Set(rows.map((row) => row.product_id))];
          const images =
            product_ids.length > 0
              ? await db
                  .selectFrom("product_images")
                  .select(["product_id", "path"])
                  .where("product_id", "in", product_ids)
                  .orderBy("sort_order")
                  .execute()
              : [];
          return rows.map((row): InventoryRow => {
            const image = images.find((entry) => entry.product_id === row.product_id);
            return {
              variant_id: row.id,
              product_id: row.product_id,
              product_title: json<LocalizedText>(row.title, {}),
              image_url: image ? storage.url(image.path, 100) : "",
              sku: row.sku,
              size: row.size,
              color: row.color,
              stock: row.stock,
              is_active: bool(row.is_active),
            };
          });
        },
      );
    },

    async adjust(variant_id, change) {
      return db.transaction().execute(async (trx) => {
        const variant = await trx
          .selectFrom("product_variants")
          .select("stock")
          .where("id", "=", variant_id)
          .executeTakeFirst();
        if (!variant) throw new BackendError("not_found");
        const stock_before = variant.stock;
        const stock_after = Math.max(0, change.mode === "set" ? change.quantity : stock_before + change.quantity);
        await trx
          .updateTable("product_variants")
          .set({ stock: stock_after, updated_at: nowIso() })
          .where("id", "=", variant_id)
          .execute();
        await trx
          .insertInto("inventory_adjustments")
          .values({
            id: newId(),
            variant_id,
            delta: stock_after - stock_before,
            stock_after,
            reason: change.reason,
            note: change.note,
            actor_id: change.actor_id || null,
          })
          .execute();
        return { stock_before, stock_after };
      });
    },

    async history(variant_id, limit) {
      const rows = await db
        .selectFrom("inventory_adjustments")
        .leftJoin("users", "users.id", "inventory_adjustments.actor_id")
        .select([
          "inventory_adjustments.id",
          "inventory_adjustments.created_at",
          "inventory_adjustments.delta",
          "inventory_adjustments.stock_after",
          "inventory_adjustments.reason",
          "inventory_adjustments.note",
          "users.name",
          "users.email",
        ])
        .where("inventory_adjustments.variant_id", "=", variant_id)
        .orderBy("inventory_adjustments.created_at", "desc")
        .limit(limit)
        .execute();
      return rows.map((row): InventoryAdjustmentEntry => ({
        id: row.id,
        created_at: iso(row.created_at),
        delta: row.delta,
        stock_after: row.stock_after,
        reason: row.reason as AdjustmentReason,
        note: row.note,
        actor_name: row.name || row.email || "",
      }));
    },
  };
}
