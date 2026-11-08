import "server-only";

import type { AbandonedCheckoutRow, AbandonedCheckoutsBackend } from "@repo/core/backend/types";
import type { PricedLine } from "@repo/core/lib/checkout/checkout-server";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { iso, json, nowIso } from "@repo/backend-sql/values";

export function createAbandonedCheckouts(ctx: SqlContext): AbandonedCheckoutsBackend {
  const { db } = ctx;

  return {
    async saveContact(session_id, email) {
      await db
        .updateTable("checkout_sessions")
        .set({ email, contact_at: nowIso(), updated_at: nowIso() })
        .where("id", "=", session_id)
        .where("status", "=", "open")
        .execute();
    },

    async list(filters, page_size, contact_before) {
      let query = db
        .selectFrom("checkout_sessions")
        .where("status", "in", ["open", "expired"])
        .where("email", "!=", "")
        .where("contact_at", "is not", null)
        .where("contact_at", "<", contact_before);
      if (filters.recovery === "sent") query = query.where("recovery_sent_at", "is not", null);
      if (filters.recovery === "not_sent") query = query.where("recovery_sent_at", "is", null);
      if (filters.search) query = query.where(contains(ctx, "email", filters.search));
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query
              .select([
                "id",
                "email",
                "locale",
                "currency",
                "total",
                "line_items",
                "created_at",
                "contact_at",
                "recovery_sent_at",
              ])
              .orderBy("contact_at", "desc")
              .orderBy("id")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map((row): AbandonedCheckoutRow => {
            const lines = json<PricedLine[]>(row.line_items, []);
            return {
              id: row.id,
              email: row.email,
              locale: row.locale,
              currency: row.currency,
              total: row.total,
              item_count: lines.reduce((sum, line) => sum + line.quantity, 0),
              items: lines.slice(0, 3).map((line) => line.title),
              created_at: iso(row.created_at),
              contact_at: iso(row.contact_at),
              recovery_sent_at: iso(row.recovery_sent_at),
            };
          }),
      );
    },

    async due(contact_before, contact_after, limit) {
      const rows = await db
        .selectFrom("checkout_sessions")
        .select("id")
        .where("status", "in", ["open", "expired"])
        .where("email", "!=", "")
        .where("recovery_sent_at", "is", null)
        .where("contact_at", "<", contact_before)
        .where("contact_at", ">", contact_after)
        .orderBy("contact_at")
        .limit(limit)
        .execute();
      return rows.map((row) => row.id);
    },

    async markRecoverySent(session_id, expires_at) {
      await db
        .updateTable("checkout_sessions")
        .set({ recovery_sent_at: nowIso(), expires_at, status: "open", updated_at: nowIso() })
        .where("id", "=", session_id)
        .where("status", "in", ["open", "expired"])
        .execute();
    },

    async recoverySentAt(session_id) {
      const row = await db
        .selectFrom("checkout_sessions")
        .select("recovery_sent_at")
        .where("id", "=", session_id)
        .executeTakeFirst();
      return iso(row?.recovery_sent_at ?? null);
    },
  };
}
