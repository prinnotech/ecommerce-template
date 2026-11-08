import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { MessagesBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";

// contact_messages has no API rules in PocketBase, so everything goes through the superuser client.
export const messages: MessagesBackend = {
  async create(message) {
    const pb = await createAdminPocketBase();
    await pb.collection("contact_messages").create({ ...message, status: "new" });
  },

  async list(filters, page_size) {
    const pb = await createAdminPocketBase();
    const filter =
      filters.status === "inbox" ? 'status != "archived"' : pb.filter("status = {:status}", { status: filters.status });
    const result = await pb.collection("contact_messages").getList(filters.page, page_size, {
      filter,
      sort: "-created_at",
      fields: "id,name,email,phone,subject,message,status,created_at",
    });
    return { items: result.items, page: result.page, total_pages: result.totalPages, total_items: result.totalItems };
  },

  async setStatus(id, status) {
    const pb = await createAdminPocketBase();
    try {
      await pb.collection("contact_messages").update(id, { status });
    } catch (error) {
      if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
      throw error;
    }
  },

  async setStatusMany(ids, status) {
    const pb = await createAdminPocketBase();
    const filter = ids.map((id, index) => pb.filter(`id = {:p${index}}`, { [`p${index}`]: id })).join(" || ");
    const existing = await pb.collection("contact_messages").getFullList({ filter, fields: "id" });
    if (existing.length === 0) return 0;
    const batch = pb.createBatch();
    for (const row of existing) batch.collection("contact_messages").update(row.id, { status });
    await batch.send();
    return existing.length;
  },

  async countUnread() {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("contact_messages").getList(1, 1, { filter: 'status = "new"', fields: "id" });
    return result.totalItems;
  },
};
