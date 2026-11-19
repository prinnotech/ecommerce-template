import "server-only";

import type { MessageChannel, MessageLogBackend, MessageLogEntry, MessageLogStatus } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import type { MessageLogResponse } from "@repo/backend-pocketbase/pocketbase-types";

function toEntry(record: MessageLogResponse): MessageLogEntry {
  return {
    id: record.id,
    created_at: record.created_at,
    channel: record.channel as MessageChannel,
    event: record.event,
    recipient: record.recipient,
    body: record.body,
    status: record.status as MessageLogStatus,
    error: record.error,
    provider_ref: record.provider_ref,
    order_id: record.order,
  };
}

export const message_log: MessageLogBackend = {
  async log(entry) {
    const pb = await createAdminPocketBase();
    const { order_id, ...fields } = entry;
    await pb.collection("message_log").create({ ...fields, order: order_id });
  },

  async list(page, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("message_log").getList(page, page_size, { sort: "-created_at" });
    return {
      items: result.items.map(toEntry),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async listForOrder(order_id) {
    const pb = await createAdminPocketBase();
    const records = await pb
      .collection("message_log")
      .getFullList({ filter: pb.filter("order = {:order_id}", { order_id }), sort: "-created_at" });
    return records.map(toEntry);
  },
};
