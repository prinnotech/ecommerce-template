import "server-only";

import type { MessageChannel, MessageLogBackend, MessageLogEntry, MessageLogStatus } from "@repo/core/backend/types";
import { paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { iso, newId } from "@repo/backend-sql/values";

const COLUMNS = [
  "id",
  "created_at",
  "channel",
  "event",
  "recipient",
  "body",
  "status",
  "error",
  "provider_ref",
  "order_id",
] as const;

type Row = {
  [K in (typeof COLUMNS)[number]]: K extends "order_id" ? string | null : K extends "created_at" ? unknown : string;
};

function toEntry(row: Row): MessageLogEntry {
  return {
    ...row,
    created_at: iso(row.created_at),
    channel: row.channel as MessageChannel,
    status: row.status as MessageLogStatus,
    order_id: row.order_id ?? "",
  };
}

export function createMessageLog({ db }: SqlContext): MessageLogBackend {
  return {
    async log(entry) {
      await db
        .insertInto("message_log")
        .values({ id: newId(), ...entry, order_id: entry.order_id || null })
        .execute();
    },

    async list(page, page_size) {
      return paginate(
        page,
        page_size,
        async () =>
          toCount(
            await db
              .selectFrom("message_log")
              .select((eb) => eb.fn.countAll().as("count"))
              .executeTakeFirst(),
          ),
        async (offset, limit) =>
          (
            await db
              .selectFrom("message_log")
              .select(COLUMNS)
              .orderBy("created_at", "desc")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map(toEntry),
      );
    },

    async listForOrder(order_id) {
      const rows = await db
        .selectFrom("message_log")
        .select(COLUMNS)
        .where("order_id", "=", order_id)
        .orderBy("created_at", "desc")
        .execute();
      return rows.map(toEntry);
    },
  };
}
