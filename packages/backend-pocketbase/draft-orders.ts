import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { DraftLine, DraftOrder, DraftOrderFields, DraftOrdersBackend } from "@repo/core/backend/types";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { DraftDiscount, DraftListFilters, DraftStatus } from "@repo/core/lib/schemas/draft-orders";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { DraftOrdersResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

type DraftRecord = DraftOrdersResponse<DraftDiscount | null, DraftLine[] | null, AddressFields | null>;

const NUMBER_ATTEMPTS = 5;

function toDraft(record: DraftRecord): DraftOrder {
  return {
    id: record.id,
    draft_number: record.draft_number,
    status: record.status as DraftStatus,
    created_at: record.created_at,
    updated_at: record.updated_at,
    user_id: record.user,
    email: record.email,
    customer_name: record.customer_name,
    phone: record.phone,
    locale: record.locale,
    lines: record.lines ?? [],
    shipping_address: record.shipping_address ?? null,
    shipping_method: record.shipping_method,
    // A PocketBase number can't be empty, so "no override" is a separate flag.
    shipping_price: record.has_shipping_price ? record.shipping_price : null,
    discount: record.discount ?? null,
    note: record.note,
    order_id: record.order,
    checkout_session_id: record.checkout_session,
    total: record.total,
    currency: record.currency,
  };
}

function fieldsOf(fields: DraftOrderFields) {
  return {
    user: fields.user_id,
    email: fields.email,
    customer_name: fields.customer_name,
    phone: fields.phone,
    locale: fields.locale,
    lines: fields.lines,
    shipping_address: fields.shipping_address,
    shipping_method: fields.shipping_method,
    shipping_price: fields.shipping_price ?? 0,
    has_shipping_price: fields.shipping_price !== null,
    discount: fields.discount,
    note: fields.note,
    total: fields.total,
    currency: fields.currency,
  };
}

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

function buildFilter(pb: TypedPocketBase, filters: DraftListFilters): string {
  const parts: string[] = [];
  if (filters.status !== "all") parts.push(pb.filter("status = {:status}", { status: filters.status }));
  if (filters.search) {
    const number = Number(filters.search.replace(/^#?d/i, ""));
    const by_number =
      Number.isInteger(number) && number > 0 ? pb.filter(" || draft_number = {:number}", { number }) : "";
    parts.push(
      pb.filter("(customer_name ~ {:search} || email ~ {:search}", { search: filters.search }) + by_number + ")",
    );
  }
  return parts.join(" && ");
}

export const draft_orders: DraftOrdersBackend = {
  async list(filters, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("draft_orders").getList<DraftRecord>(filters.page, page_size, {
      filter: buildFilter(pb, filters),
      sort: "-draft_number",
      fields: "id,draft_number,status,created_at,customer_name,email,total,currency,order",
    });
    return {
      items: result.items.map((record) => ({
        id: record.id,
        draft_number: record.draft_number,
        status: record.status as DraftStatus,
        created_at: record.created_at,
        customer_name: record.customer_name,
        email: record.email,
        total: record.total,
        currency: record.currency,
        order_id: record.order,
      })),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    return toDraft(await pb.collection("draft_orders").getOne<DraftRecord>(id).catch(notFound));
  },

  async create(fields, created_by) {
    const pb = await createAdminPocketBase();
    for (let attempt = 1; ; attempt++) {
      const last = await pb
        .collection("draft_orders")
        .getList<DraftRecord>(1, 1, { sort: "-draft_number", fields: "draft_number", skipTotal: true });
      try {
        const record = await pb.collection("draft_orders").create({
          ...fieldsOf(fields),
          draft_number: (last.items[0]?.draft_number ?? 0) + 1,
          status: "open",
          created_by,
        });
        return { id: record.id };
      } catch (error) {
        // Two drafts created at the same moment: take the next number.
        if (pocketBaseFieldCode(error, "draft_number") === "validation_not_unique" && attempt < NUMBER_ATTEMPTS)
          continue;
        throw error;
      }
    }
  },

  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("draft_orders").update(id, fieldsOf(fields)).catch(notFound);
  },

  async delete(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("draft_orders").delete(id).catch(notFound);
  },

  async setInvoiceSession(id, checkout_session_id) {
    const pb = await createAdminPocketBase();
    await pb.collection("draft_orders").update(id, { checkout_session: checkout_session_id, status: "invoice_sent" });
  },

  async bySession(checkout_session_id) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("draft_orders").getList<DraftRecord>(1, 1, {
      filter: pb.filter("checkout_session = {:session}", { session: checkout_session_id }),
      skipTotal: true,
    });
    return result.items[0] ? toDraft(result.items[0]) : null;
  },

  async complete(id, order_id) {
    const pb = await createAdminPocketBase();
    await pb.collection("draft_orders").update(id, { order: order_id, status: "completed" });
  },
};
