import "server-only";

import type { Selectable } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { DraftLine, DraftOrder, DraftOrderFields, DraftOrdersBackend } from "@repo/core/backend/types";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { DraftDiscount, DraftStatus } from "@repo/core/lib/schemas/draft-orders";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import type { DraftOrdersTable } from "@repo/backend-sql/schema";
import { iso, json, newId, nowIso } from "@repo/backend-sql/values";

const NUMBER_ATTEMPTS = 5;

function toDraft(row: Selectable<DraftOrdersTable>): DraftOrder {
  return {
    id: row.id,
    draft_number: row.draft_number,
    status: row.status as DraftStatus,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    user_id: row.user_id ?? "",
    email: row.email,
    customer_name: row.customer_name,
    phone: row.phone,
    locale: row.locale,
    lines: json<DraftLine[]>(row.lines, []),
    shipping_address: json<AddressFields | null>(row.shipping_address, null),
    shipping_method: row.shipping_method,
    shipping_price: row.shipping_price,
    discount: json<DraftDiscount | null>(row.discount, null),
    note: row.note,
    order_id: row.order_id ?? "",
    checkout_session_id: row.checkout_session_id ?? "",
    total: row.total,
    currency: row.currency,
  };
}

function columns(fields: DraftOrderFields) {
  return {
    user_id: fields.user_id || null,
    email: fields.email,
    customer_name: fields.customer_name,
    phone: fields.phone,
    locale: fields.locale,
    lines: fields.lines,
    shipping_address: fields.shipping_address,
    shipping_method: fields.shipping_method,
    shipping_price: fields.shipping_price,
    discount: fields.discount,
    note: fields.note,
    total: fields.total,
    currency: fields.currency,
  };
}

export function createDraftOrders(ctx: SqlContext): DraftOrdersBackend {
  const { db } = ctx;

  async function exists(id: string) {
    const row = await db.selectFrom("draft_orders").select("id").where("id", "=", id).executeTakeFirst();
    if (!row) throw new BackendError("not_found");
  }

  return {
    async list(filters, page_size) {
      let query = db.selectFrom("draft_orders");
      if (filters.status !== "all") query = query.where("status", "=", filters.status);
      if (filters.search) {
        const search = filters.search;
        const number = Number(search.replace(/^#?d/i, ""));
        query = query.where((eb) =>
          eb.or([
            contains(ctx, "customer_name", search),
            contains(ctx, "email", search),
            ...(Number.isInteger(number) && number > 0 ? [eb("draft_number", "=", number)] : []),
          ]),
        );
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query
              .select([
                "id",
                "draft_number",
                "status",
                "created_at",
                "customer_name",
                "email",
                "total",
                "currency",
                "order_id",
              ])
              .orderBy("draft_number", "desc")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map((row) => ({
            ...row,
            status: row.status as DraftStatus,
            created_at: iso(row.created_at),
            order_id: row.order_id ?? "",
          })),
      );
    },

    async get(id) {
      const row = await db.selectFrom("draft_orders").selectAll().where("id", "=", id).executeTakeFirst();
      if (!row) throw new BackendError("not_found");
      return toDraft(row);
    },

    async create(fields, created_by) {
      for (let attempt = 1; ; attempt++) {
        const last = await db
          .selectFrom("draft_orders")
          .select((eb) => eb.fn.max("draft_number").as("max"))
          .executeTakeFirst();
        const id = newId();
        try {
          await db
            .insertInto("draft_orders")
            .values({
              id,
              draft_number: Number(last?.max ?? 0) + 1,
              status: "open",
              ...columns(fields),
              created_by: created_by || null,
            })
            .execute();
          return { id };
        } catch (error) {
          // Two drafts created at the same moment: take the next number.
          if (uniqueViolation(error)?.includes("draft_number") && attempt < NUMBER_ATTEMPTS) continue;
          throw error;
        }
      }
    },

    async update(id, fields) {
      await exists(id);
      await db
        .updateTable("draft_orders")
        .set({ ...columns(fields), updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
    },

    async delete(id) {
      await exists(id);
      await db.deleteFrom("draft_orders").where("id", "=", id).execute();
    },

    async setInvoiceSession(id, checkout_session_id) {
      await db
        .updateTable("draft_orders")
        .set({ checkout_session_id, status: "invoice_sent", updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
    },

    async bySession(checkout_session_id) {
      const row = await db
        .selectFrom("draft_orders")
        .selectAll()
        .where("checkout_session_id", "=", checkout_session_id)
        .executeTakeFirst();
      return row ? toDraft(row) : null;
    },

    async complete(id, order_id) {
      await db
        .updateTable("draft_orders")
        .set({ order_id, status: "completed", updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
    },
  };
}
