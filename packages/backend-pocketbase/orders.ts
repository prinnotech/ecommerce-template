import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminOrderRow, OrderState, OrdersBackend } from "@repo/core/backend/types";
import { ARCHIVED_STATUSES, OPEN_STATUSES } from "@repo/core/lib/orders";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { OrderListFilters } from "@repo/core/lib/schemas/orders";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type {
  OrderEventsResponse,
  OrdersResponse,
  TypedPocketBase,
  UsersResponse,
} from "@repo/backend-pocketbase/pocketbase-types";
import { parseAttribution } from "@repo/core/lib/tracking/attribution";

// Admin order work with the superuser client. Callers are authorized and the lifecycle rules
// (lib/orders.ts) checked in the actions first.

export type OrderRecord = OrdersResponse<unknown, AddressFields | null, AddressFields | null>;
type Batch = ReturnType<TypedPocketBase["createBatch"]>;

export const ORDER_ROW_FIELDS =
  "id,order_number,created_at,shipping_address,email,status,payment_status,payment_method,total,currency";

async function itemCounts(pb: TypedPocketBase, order_ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (order_ids.length === 0) return counts;
  const items = await pb.collection("order_items").getFullList({
    filter: order_ids.map((id, index) => pb.filter(`order = {:o${index}}`, { [`o${index}`]: id })).join(" || "),
    fields: "order,quantity",
  });
  for (const item of items) counts.set(item.order, (counts.get(item.order) ?? 0) + item.quantity);
  return counts;
}

export async function toOrderRows(pb: TypedPocketBase, orders: OrderRecord[]): Promise<AdminOrderRow[]> {
  const counts = await itemCounts(
    pb,
    orders.map((order) => order.id),
  );
  return orders.map((order) => ({
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    customer_name: order.shipping_address?.full_name || order.email,
    email: order.email,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    total: order.total,
    currency: order.currency,
    item_count: counts.get(order.id) ?? 0,
  }));
}

function buildListFilter(pb: TypedPocketBase, filters: OrderListFilters): string {
  const parts = ['deleted_at = ""'];
  if (filters.status === "open") parts.push(`(${OPEN_STATUSES.map((status) => `status = "${status}"`).join(" || ")})`);
  else if (filters.status === "archived")
    parts.push(`(${ARCHIVED_STATUSES.map((status) => `status = "${status}"`).join(" || ")})`);
  else if (filters.status !== "all") parts.push(pb.filter("status = {:status}", { status: filters.status }));
  if (filters.payment !== "all") parts.push(pb.filter("payment_status = {:payment}", { payment: filters.payment }));
  if (filters.search) {
    const number = Number(filters.search.replace(/^#/, ""));
    parts.push(
      Number.isInteger(number) && number > 0
        ? pb.filter("order_number = {:number}", { number })
        : pb.filter("(email ~ {:q} || shipping_address ~ {:q} || phone ~ {:q})", { q: filters.search }),
    );
  }
  return parts.join(" && ");
}

// Puts an order's items back in stock (skipping variants that no longer exist).
async function addRestock(
  pb: TypedPocketBase,
  batch: Batch,
  order: { id: string; order_number: number },
  actor_id: string,
) {
  const items = await pb
    .collection("order_items")
    .getFullList({ filter: pb.filter("order = {:id}", { id: order.id }), fields: "variant,quantity" });
  const variant_ids = [...new Set(items.map((item) => item.variant).filter(Boolean))];
  const existing =
    variant_ids.length > 0
      ? await pb.collection("product_variants").getFullList({
          filter: variant_ids.map((id, index) => pb.filter(`id = {:v${index}}`, { [`v${index}`]: id })).join(" || "),
          fields: "id,stock",
        })
      : [];
  const stock = new Map(existing.map((variant) => [variant.id, variant.stock]));
  for (const item of items) {
    const before = stock.get(item.variant);
    if (before === undefined) continue;
    batch.collection("product_variants").update(item.variant, { "stock+": item.quantity });
    stock.set(item.variant, before + item.quantity);
    batch.collection("inventory_adjustments").create({
      variant: item.variant,
      delta: item.quantity,
      stock_after: before + item.quantity,
      reason: "restock",
      note: `#${order.order_number}`,
      actor_id,
    });
  }
}

// Puts the refunded lines back in stock (variants that no longer exist are skipped), logged.
async function addLineRestock(
  pb: TypedPocketBase,
  batch: Batch,
  order: { id: string; order_number: number },
  refund: { lines: { item_id: string; quantity: number }[]; actor: string },
) {
  const items = await pb
    .collection("order_items")
    .getFullList({ filter: pb.filter("order = {:id}", { id: order.id }), fields: "id,variant" });
  const variant_ids = [...new Set(items.map((item) => item.variant).filter(Boolean))];
  const existing =
    variant_ids.length > 0
      ? await pb.collection("product_variants").getFullList({
          filter: variant_ids.map((id, index) => pb.filter(`id = {:v${index}}`, { [`v${index}`]: id })).join(" || "),
          fields: "id,stock",
        })
      : [];
  const stock = new Map(existing.map((variant) => [variant.id, variant.stock]));
  for (const line of refund.lines) {
    const variant = items.find((item) => item.id === line.item_id)?.variant;
    const before = variant ? stock.get(variant) : undefined;
    if (!variant || before === undefined) continue;
    batch.collection("product_variants").update(variant, { "stock+": line.quantity });
    stock.set(variant, before + line.quantity);
    batch.collection("inventory_adjustments").create({
      variant,
      delta: line.quantity,
      stock_after: before + line.quantity,
      reason: "restock",
      note: `#${order.order_number}`,
      actor_id: refund.actor,
    });
  }
}

type RefundRecord = {
  id: string;
  created_at: string;
  amount: number;
  reason: string;
  lines: unknown;
  restocked: boolean;
  actor_id: string;
};

async function refundsWithActors(pb: TypedPocketBase, refunds: RefundRecord[]) {
  const actor_ids = [...new Set(refunds.map((refund) => refund.actor_id).filter(Boolean))];
  const actors =
    actor_ids.length > 0
      ? await pb.collection("users").getFullList({
          filter: actor_ids.map((id, index) => pb.filter(`id = {:u${index}}`, { [`u${index}`]: id })).join(" || "),
          fields: "id,name,email",
        })
      : [];
  const names = new Map(actors.map((actor) => [actor.id, actor.name || actor.email]));
  return refunds.map((refund) => ({
    id: refund.id,
    created_at: refund.created_at,
    amount: refund.amount,
    reason: refund.reason,
    lines: Array.isArray(refund.lines) ? (refund.lines as { item_id: string; quantity: number }[]) : [],
    restocked: refund.restocked,
    actor_name: names.get(refund.actor_id) ?? "",
  }));
}

export const orders: OrdersBackend = {
  async list(filters, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("orders").getList<OrderRecord>(filters.page, page_size, {
      filter: buildListFilter(pb, filters),
      sort: "-created_at",
      fields: ORDER_ROW_FIELDS,
    });
    return {
      items: await toOrderRows(pb, result.items),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async getIdByNumber(order_number) {
    const pb = await createAdminPocketBase();
    const records = await pb
      .collection("orders")
      .getList(1, 1, { filter: pb.filter("order_number = {:number}", { number: order_number }), fields: "id" });
    return records.items[0]?.id ?? null;
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const order = await pb
      .collection("orders")
      .getOne<OrderRecord>(id, { expand: "discount_code" })
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
        throw error;
      });
    if (order.deleted_at) throw new BackendError("not_found");

    const by_order = pb.filter("order = {:id}", { id });
    const [items, events, payments, customer_orders, user, refunds] = await Promise.all([
      pb.collection("order_items").getFullList({ filter: by_order, sort: "created_at" }),
      pb.collection("order_events").getFullList<OrderEventsResponse<{ actor?: UsersResponse }>>({
        filter: by_order,
        sort: "-created_at",
        expand: "actor",
      }),
      pb.collection("payments").getFullList({
        filter: order.checkout_session
          ? pb.filter("order = {:id} || checkout_session = {:session}", { id, session: order.checkout_session })
          : by_order,
        sort: "-created_at",
      }),
      order.user
        ? pb
            .collection("orders")
            .getList(1, 1, { filter: pb.filter("user = {:user}", { user: order.user }), fields: "id" })
        : null,
      order.user
        ? pb
            .collection("users")
            .getOne(order.user, { fields: "id,name" })
            .catch(() => null)
        : null,
      pb.collection("refunds").getFullList({ filter: by_order, sort: "-created_at" }),
    ]);

    const discount = (order.expand as { discount_code?: { code: string } } | undefined)?.discount_code;
    return {
      id: order.id,
      order_number: order.order_number,
      created_at: order.created_at,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      currency: order.currency,
      subtotal: order.subtotal,
      discount_total: order.discount_total,
      shipping_total: order.shipping_total,
      tax_total: order.tax_total,
      cod_fee: order.cod_fee,
      total: order.total,
      email: order.email,
      phone: order.phone,
      locale: order.locale,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      shipping_method: order.shipping_method,
      customer_note: order.customer_note,
      internal_note: order.internal_note,
      attribution: order.attribution ? parseAttribution(order.attribution) : null,
      refunded_total: order.refunded_total,
      gift_card_total: order.gift_card_total,
      checkout_session_id: order.checkout_session ?? "",
      refunds: await refundsWithActors(pb, refunds),
      tracking_number: order.tracking_number,
      carrier: order.carrier,
      tracking_url: order.tracking_url,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      cancelled_at: order.cancelled_at,
      items: items.map((item) => ({
        id: item.id,
        product: item.product,
        variant: item.variant,
        title: item.title,
        variant_label: item.variant_label,
        sku: item.sku,
        image: item.image,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: item.line_total,
      })),
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        from_status: event.from_status,
        to_status: event.to_status,
        message: event.message,
        is_customer_visible: event.is_customer_visible,
        created_at: event.created_at,
        actor_name: event.expand?.actor?.name || event.expand?.actor?.email || "",
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        provider_ref: payment.provider_ref ?? "",
        status: payment.status,
        amount: payment.amount,
        error_code: payment.error_code,
        created_at: payment.created_at,
      })),
      customer: order.user
        ? { user_id: order.user, name: user?.name ?? "", order_count: customer_orders?.totalItems ?? 1 }
        : null,
      discount_code: discount?.code ?? "",
    };
  },

  async getState(id) {
    const pb = await createAdminPocketBase();
    const order = await pb
      .collection("orders")
      .getOne<OrderRecord>(id, {
        fields: "id,order_number,status,payment_status,payment_method,total,currency,refunded_total,deleted_at",
      })
      .catch(() => null);
    if (!order || order.deleted_at) return null;
    const { deleted_at: _deleted_at, ...state } = order;
    return state satisfies OrderState;
  },

  async changeStatus(order, to, { actor, timestamp_field, restock }) {
    const pb = await createAdminPocketBase();
    const batch = pb.createBatch();
    batch
      .collection("orders")
      .update(order.id, { status: to, ...(timestamp_field ? { [timestamp_field]: new Date().toISOString() } : {}) });
    batch.collection("order_events").create({
      order: order.id,
      type: "status_changed",
      from_status: order.status,
      to_status: to,
      actor,
      is_customer_visible: true,
    });
    if (restock) await addRestock(pb, batch, order, actor);
    await batch.send();
  },

  async markPaid(order, actor) {
    const pb = await createAdminPocketBase();
    const pending = await pb
      .collection("payments")
      .getFirstListItem(pb.filter('order = {:id} && status = "pending"', { id: order.id }))
      .catch(() => null);

    const batch = pb.createBatch();
    batch.collection("orders").update(order.id, { payment_status: "paid", paid_at: new Date().toISOString() });
    if (pending) batch.collection("payments").update(pending.id, { status: "succeeded" });
    else {
      batch.collection("payments").create({
        order: order.id,
        provider: order.payment_method || "cash_on_delivery",
        amount: order.total,
        currency: order.currency,
        status: "succeeded",
      });
    }
    batch.collection("order_events").create({
      order: order.id,
      type: "payment_status_changed",
      from_status: order.payment_status,
      to_status: "paid",
      actor,
      is_customer_visible: true,
    });
    await batch.send();
  },

  async refund(order, refund) {
    const pb = await createAdminPocketBase();
    const current = await pb.collection("orders").getOne(order.id, { fields: "refunded_total,total" });
    const refunded_total = Math.min(current.total, current.refunded_total + refund.amount);
    const is_full = refunded_total >= current.total;
    const payment_status = is_full ? "refunded" : "partially_refunded";
    const paid = is_full
      ? await pb
          .collection("payments")
          .getFirstListItem(pb.filter('order = {:id} && status = "succeeded"', { id: order.id }))
          .catch(() => null)
      : null;

    const batch = pb.createBatch();
    batch
      .collection("orders")
      .update(order.id, { refunded_total, payment_status, ...(is_full ? { status: "refunded" } : {}) });
    if (paid) batch.collection("payments").update(paid.id, { status: "refunded" });
    batch.collection("refunds").create({
      order: order.id,
      amount: refund.amount,
      lines: refund.lines,
      reason: refund.reason,
      restocked: refund.restock,
      provider_ref: refund.provider_ref,
      actor_id: refund.actor,
    });
    batch.collection("order_events").create({
      order: order.id,
      type: "refund",
      from_status: order.payment_status,
      to_status: payment_status,
      message: refund.reason,
      actor: refund.actor,
      is_customer_visible: true,
    });
    if (refund.restock && refund.lines.length > 0) await addLineRestock(pb, batch, order, refund);
    await batch.send();
    return { refunded_total, is_full };
  },

  async updateTracking(order, tracking, { actor, ship }) {
    const pb = await createAdminPocketBase();
    const batch = pb.createBatch();
    batch.collection("orders").update(order.id, {
      ...tracking,
      ...(ship ? { status: "shipped", shipped_at: new Date().toISOString() } : {}),
    });
    batch.collection("order_events").create({
      order: order.id,
      type: ship ? "shipped" : "note",
      from_status: ship ? order.status : "",
      to_status: ship ? "shipped" : "",
      message: [tracking.carrier, tracking.tracking_number].filter(Boolean).join(" · "),
      actor,
      // A tracking update without shipping is internal bookkeeping.
      is_customer_visible: ship,
    });
    await batch.send();
  },

  async addNote(order_id, note) {
    const pb = await createAdminPocketBase();
    await pb.collection("order_events").create({ order: order_id, type: "note", ...note });
  },

  async setInternalNote(order_id, internal_note) {
    const pb = await createAdminPocketBase();
    await pb.collection("orders").update(order_id, { internal_note });
  },
};
