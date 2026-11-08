import "server-only";

import type { EmailLogBackend, EmailLogEntry, EmailLogStatus } from "@repo/core/backend/types";
import { paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { iso, newId } from "@repo/backend-sql/values";

export function createEmailLog({ db }: SqlContext): EmailLogBackend {
  return {
    async log(entry) {
      await db
        .insertInto("email_log")
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
              .selectFrom("email_log")
              .select((eb) => eb.fn.countAll().as("count"))
              .executeTakeFirst(),
          ),
        async (offset, limit) =>
          (
            await db
              .selectFrom("email_log")
              .select(["id", "created_at", "template", "recipient", "subject", "status", "error", "order_id"])
              .orderBy("created_at", "desc")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map((row): EmailLogEntry => ({
            ...row,
            created_at: iso(row.created_at),
            status: row.status as EmailLogStatus,
            order_id: row.order_id ?? "",
          })),
      );
    },
  };
}
