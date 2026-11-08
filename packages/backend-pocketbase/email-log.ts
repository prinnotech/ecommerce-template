import "server-only";

import type { EmailLogBackend, EmailLogStatus } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";

export const email_log: EmailLogBackend = {
  async log(entry) {
    const pb = await createAdminPocketBase();
    const { order_id, ...fields } = entry;
    await pb.collection("email_log").create({ ...fields, order: order_id });
  },

  async list(page, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("email_log").getList(page, page_size, { sort: "-created_at" });
    return {
      items: result.items.map((record) => ({
        id: record.id,
        created_at: record.created_at,
        template: record.template,
        recipient: record.recipient,
        subject: record.subject,
        status: record.status as EmailLogStatus,
        error: record.error,
        order_id: record.order,
      })),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },
};
