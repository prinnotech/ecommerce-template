import "server-only";

import type { WishlistBackend } from "@repo/core/backend/types";
import type { SqlContext } from "@repo/backend-sql/context";
import { newId } from "@repo/backend-sql/values";

export function createWishlist({ db }: SqlContext): WishlistBackend {
  return {
    async list(user_id) {
      const rows = await db
        .selectFrom("wishlist_items")
        .select("product_id")
        .where("user_id", "=", user_id)
        .orderBy("created_at", "desc")
        .execute();
      return rows.map((row) => row.product_id);
    },

    async add(user_id, product_ids) {
      if (product_ids.length === 0) return;
      const existing = new Set(
        (
          await db
            .selectFrom("wishlist_items")
            .select("product_id")
            .where("user_id", "=", user_id)
            .where("product_id", "in", product_ids)
            .execute()
        ).map((row) => row.product_id),
      );
      const live = new Set(
        (await db.selectFrom("products").select("id").where("id", "in", product_ids).execute()).map((row) => row.id),
      );
      const rows = [...new Set(product_ids)]
        .filter((product_id) => live.has(product_id) && !existing.has(product_id))
        .map((product_id) => ({ id: newId(), user_id, product_id }));
      if (rows.length > 0) await db.insertInto("wishlist_items").values(rows).execute();
    },

    async remove(user_id, product_id) {
      await db
        .deleteFrom("wishlist_items")
        .where("user_id", "=", user_id)
        .where("product_id", "=", product_id)
        .execute();
    },
  };
}
