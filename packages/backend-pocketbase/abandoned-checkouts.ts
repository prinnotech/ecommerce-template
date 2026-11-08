import "server-only";

import type { AbandonedCheckoutsBackend } from "@repo/core/backend/types";
import type { PricedLine } from "@repo/core/lib/checkout/checkout-server";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import type { CheckoutSessionsResponse } from "@repo/backend-pocketbase/pocketbase-types";

type SessionRecord = CheckoutSessionsResponse<unknown, unknown, PricedLine[] | null>;

const pbDate = (iso: string) => iso.replace("T", " ");
const ABANDONED = '(status = "open" || status = "expired") && email != ""';

export const abandoned_checkouts: AbandonedCheckoutsBackend = {
  async saveContact(session_id, email) {
    const pb = await createAdminPocketBase();
    const session = await pb
      .collection("checkout_sessions")
      .getOne(session_id, { fields: "id,status" })
      .catch(() => null);
    if (session?.status !== "open") return;
    await pb.collection("checkout_sessions").update(session_id, { email, contact_at: new Date().toISOString() });
  },

  async list(filters, page_size, contact_before) {
    const pb = await createAdminPocketBase();
    const parts = [
      ABANDONED,
      pb.filter('contact_at != "" && contact_at < {:before}', { before: pbDate(contact_before) }),
    ];
    if (filters.recovery === "sent") parts.push('recovery_sent_at != ""');
    if (filters.recovery === "not_sent") parts.push('recovery_sent_at = ""');
    if (filters.search) parts.push(pb.filter("email ~ {:search}", { search: filters.search }));
    const result = await pb.collection("checkout_sessions").getList<SessionRecord>(filters.page, page_size, {
      filter: parts.join(" && "),
      sort: "-contact_at,id",
      fields: "id,email,locale,currency,total,line_items,created_at,contact_at,recovery_sent_at",
    });
    return {
      items: result.items.map((record) => {
        const lines = record.line_items ?? [];
        return {
          id: record.id,
          email: record.email,
          locale: record.locale,
          currency: record.currency,
          total: record.total,
          item_count: lines.reduce((sum, line) => sum + line.quantity, 0),
          items: lines.slice(0, 3).map((line) => line.title),
          created_at: record.created_at,
          contact_at: record.contact_at,
          recovery_sent_at: record.recovery_sent_at,
        };
      }),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async due(contact_before, contact_after, limit) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("checkout_sessions").getList(1, limit, {
      filter: `${ABANDONED} && recovery_sent_at = "" && ${pb.filter("contact_at < {:before} && contact_at > {:after}", {
        before: pbDate(contact_before),
        after: pbDate(contact_after),
      })}`,
      sort: "contact_at",
      fields: "id",
      skipTotal: true,
    });
    return result.items.map((record) => record.id);
  },

  async markRecoverySent(session_id, expires_at) {
    const pb = await createAdminPocketBase();
    await pb
      .collection("checkout_sessions")
      .update(session_id, { recovery_sent_at: new Date().toISOString(), expires_at, status: "open" });
  },

  async recoverySentAt(session_id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("checkout_sessions")
      .getOne(session_id, { fields: "recovery_sent_at" })
      .catch(() => null);
    return record?.recovery_sent_at ?? "";
  },
};
