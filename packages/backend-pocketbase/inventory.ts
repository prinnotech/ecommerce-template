import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { InventoryBackend, InventoryRow } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { AdjustmentReason, InventoryFilters } from "@repo/core/lib/schemas/inventory";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import { getFileUrl } from "@repo/backend-pocketbase/files";
import type { TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

type ExpandedProduct = { id: string; collectionId: string; title: LocalizedText | null; images?: string[] };

// PocketBase filter values must go through pb.filter() placeholders, never string concatenation.
function buildFilter(pb: TypedPocketBase, filters: InventoryFilters, threshold: number): string {
  const parts = ['product.deleted_at = ""'];
  if (filters.stock === "low") parts.push(pb.filter("stock > 0 && stock <= {:low}", { low: threshold }));
  if (filters.stock === "out") parts.push("stock <= 0");
  if (filters.category) parts.push(pb.filter("product.category = {:category}", { category: filters.category }));
  if (filters.search) {
    parts.push(
      pb.filter("(product.title ~ {:search} || sku ~ {:search} || color ~ {:search} || size ~ {:search})", {
        search: filters.search,
      }),
    );
  }
  return parts.join(" && ");
}

export const inventory: InventoryBackend = {
  async list(filters, low_stock_threshold, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("product_variants").getList(filters.page, page_size, {
      filter: buildFilter(pb, filters, low_stock_threshold),
      sort: "-product.updated_at,product,sort_order,id",
      expand: "product",
    });
    type WithProduct = (typeof result.items)[number] & { expand?: { product?: ExpandedProduct } };
    return {
      items: (result.items as WithProduct[]).map((variant): InventoryRow => {
        const product = variant.expand?.product;
        const image = product?.images?.[0];
        return {
          variant_id: variant.id,
          product_id: variant.product,
          product_title: product?.title ?? {},
          image_url: product && image ? getFileUrl(product, image, "100x100") : "",
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          is_active: variant.is_active,
        };
      }),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async adjust(variant_id, change) {
    const pb = await createAdminPocketBase();
    const variant = await pb
      .collection("product_variants")
      .getOne(variant_id, { fields: "id,stock" })
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
        throw error;
      });
    const stock_before = variant.stock;
    const stock_after = Math.max(0, change.mode === "set" ? change.quantity : stock_before + change.quantity);
    // The stock update and its log row go in one batch, so neither is saved without the other.
    const batch = pb.createBatch();
    batch.collection("product_variants").update(variant_id, { stock: stock_after });
    batch.collection("inventory_adjustments").create({
      variant: variant_id,
      delta: stock_after - stock_before,
      stock_after,
      reason: change.reason,
      note: change.note,
      actor_id: change.actor_id,
    });
    await batch.send();
    return { stock_before, stock_after };
  },

  async history(variant_id, limit) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("inventory_adjustments").getList(1, limit, {
      filter: pb.filter("variant = {:variant}", { variant: variant_id }),
      sort: "-created_at",
      skipTotal: true,
    });
    const actor_ids = [...new Set(result.items.map((item) => item.actor_id).filter((id): id is string => Boolean(id)))];
    const actors =
      actor_ids.length > 0
        ? await pb.collection("users").getFullList({
            filter: actor_ids.map((id, index) => pb.filter(`id = {:u${index}}`, { [`u${index}`]: id })).join(" || "),
            fields: "id,name,email",
          })
        : [];
    const names = new Map(actors.map((actor) => [actor.id, actor.name || actor.email]));
    return result.items.map((item) => ({
      id: item.id,
      created_at: item.created_at,
      delta: item.delta ?? 0,
      stock_after: item.stock_after ?? 0,
      reason: item.reason as AdjustmentReason,
      note: item.note ?? "",
      actor_name: item.actor_id ? (names.get(item.actor_id) ?? "") : "",
    }));
  },
};
