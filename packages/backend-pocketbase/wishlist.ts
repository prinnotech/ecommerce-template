import "server-only";

import type { WishlistBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";

export const wishlist: WishlistBackend = {
  async list(user_id) {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("wishlist_items").getFullList({
      filter: pb.filter("user = {:user}", { user: user_id }),
      sort: "-created_at",
      fields: "product",
    });
    return rows.map((row) => row.product);
  },

  async add(user_id, product_ids) {
    if (product_ids.length === 0) return;
    const pb = await createAdminPocketBase();
    const existing = new Set(await wishlist.list(user_id));
    const fresh = [...new Set(product_ids)].filter((product_id) => !existing.has(product_id));
    for (const product_id of fresh) {
      // A product deleted in the meantime fails its relation: skipped.
      await pb
        .collection("wishlist_items")
        .create({ user: user_id, product: product_id })
        .catch(() => undefined);
    }
  },

  async remove(user_id, product_id) {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("wishlist_items").getFullList({
      filter: pb.filter("user = {:user} && product = {:product}", { user: user_id, product: product_id }),
      fields: "id",
    });
    for (const row of rows) await pb.collection("wishlist_items").delete(row.id);
  },
};
