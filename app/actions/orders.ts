"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity-log";
import { authorize, type Caller } from "@/lib/auth";
import { canMarkPaid, canRefund, canTransition, OPEN_STATUSES, type OrderStatus } from "@/lib/orders";
import { ORDER_ROW_FIELDS, toOrderRows, type AdminOrderRow, type OrderRecord } from "@/lib/orders-server";
import { pocketBaseStatus } from "@/lib/pocketbase/errors";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import {
  add_order_note_schema,
  order_id_input_schema,
  order_list_filters_schema,
  refund_order_schema,
  update_internal_note_schema,
  update_order_status_schema,
  update_tracking_schema,
  type AddOrderNoteInput,
  type OrderIdInput,
  type OrderListFilters,
  type RefundOrderInput,
  type UpdateInternalNoteInput,
  type UpdateOrderStatusInput,
  type UpdateTrackingInput,
} from "@/lib/schemas/orders";
import { reportError } from "@/lib/server-log";
import type {
  OrderEventsResponse,
  OrderItemsResponse,
  PaymentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

const PAGE_SIZE = 25;

type AdminPocketBase = Awaited<ReturnType<typeof createAdminPocketBase>>;

export type { AdminOrderRow };

export type AdminOrderPage = { items: AdminOrderRow[]; page: number; total_pages: number; total_items: number };

export type AdminOrderEvent = Pick<
  OrderEventsResponse,
  "id" | "type" | "from_status" | "to_status" | "message" | "is_customer_visible" | "created_at"
> & { actor_name: string };

export type AdminOrderDetail = Pick<
  OrderRecord,
  | "id"
  | "order_number"
  | "created_at"
  | "status"
  | "payment_status"
  | "payment_method"
  | "currency"
  | "subtotal"
  | "discount_total"
  | "shipping_total"
  | "tax_total"
  | "cod_fee"
  | "total"
  | "email"
  | "phone"
  | "locale"
  | "shipping_address"
  | "billing_address"
  | "shipping_method"
  | "customer_note"
  | "internal_note"
  | "tracking_number"
  | "carrier"
  | "tracking_url"
  | "paid_at"
  | "shipped_at"
  | "delivered_at"
  | "cancelled_at"
> & {
  items: Pick<
    OrderItemsResponse,
    | "id"
    | "product"
    | "variant"
    | "title"
    | "variant_label"
    | "sku"
    | "image"
    | "unit_price"
    | "quantity"
    | "line_total"
  >[];
  events: AdminOrderEvent[];
  payments: Pick<PaymentsResponse, "id" | "provider" | "status" | "amount" | "error_code" | "created_at">[];
  customer: { user_id: string; name: string; order_count: number } | null;
  discount_code: string;
};

function buildListFilter(pb: AdminPocketBase, filters: OrderListFilters): string {
  const parts = ['deleted_at = ""'];
  if (filters.status === "open") parts.push(`(${OPEN_STATUSES.map((status) => `status = "${status}"`).join(" || ")})`);
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

export async function getAdminOrders(input: Partial<OrderListFilters>): Promise<ActionResult<AdminOrderPage>> {
  const auth = await authorize("orders.view", "view orders");
  if (!auth.ok) return auth;
  const filters = order_list_filters_schema.parse(input);

  try {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("orders").getList<OrderRecord>(filters.page, PAGE_SIZE, {
      filter: buildListFilter(pb, filters),
      sort: "-created_at",
      fields: ORDER_ROW_FIELDS,
    });
    return ok({
      items: await toOrderRows(pb, result.items),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    });
  } catch (error) {
    await reportError("orders", "getAdminOrders", error);
    return fail("generic");
  }
}

export async function getAdminOrder(id: string): Promise<ActionResult<AdminOrderDetail>> {
  const auth = await authorize("orders.view", "view an order");
  if (!auth.ok) return auth;
  if (!order_id_input_schema.safeParse({ id }).success) return fail("not_found");

  try {
    const pb = await createAdminPocketBase();
    const order = await pb.collection("orders").getOne<OrderRecord>(id, { expand: "discount_code" });
    if (order.deleted_at) return fail("not_found");

    const by_order = pb.filter("order = {:id}", { id });
    const [items, events, payments, customer_orders, user] = await Promise.all([
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
    ]);

    const discount = (order.expand as { discount_code?: { code: string } } | undefined)?.discount_code;
    return ok({
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
        status: payment.status,
        amount: payment.amount,
        error_code: payment.error_code,
        created_at: payment.created_at,
      })),
      customer: order.user
        ? { user_id: order.user, name: user?.name ?? "", order_count: customer_orders?.totalItems ?? 1 }
        : null,
      discount_code: discount?.code ?? "",
    });
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("orders", "getAdminOrder", error);
    return fail("generic");
  }
}

async function loadOrder(pb: AdminPocketBase, id: string) {
  const order = await pb
    .collection("orders")
    .getOne<OrderRecord>(id)
    .catch(() => null);
  return order && !order.deleted_at ? order : null;
}

// Puts an order's items back in stock (skipping variants that no longer exist).
async function addRestock(pb: AdminPocketBase, batch: ReturnType<AdminPocketBase["createBatch"]>, order_id: string) {
  const items = await pb
    .collection("order_items")
    .getFullList({ filter: pb.filter("order = {:id}", { id: order_id }), fields: "variant,quantity" });
  const variant_ids = [...new Set(items.map((item) => item.variant).filter(Boolean))];
  const existing =
    variant_ids.length > 0
      ? await pb.collection("product_variants").getFullList({
          filter: variant_ids.map((id, index) => pb.filter(`id = {:v${index}}`, { [`v${index}`]: id })).join(" || "),
          fields: "id",
        })
      : [];
  const existing_ids = new Set(existing.map((variant) => variant.id));
  for (const item of items) {
    if (existing_ids.has(item.variant))
      batch.collection("product_variants").update(item.variant, { "stock+": item.quantity });
  }
}

function log(caller: Caller, action: string, order: OrderRecord, details: Record<string, unknown>) {
  return logActivity({
    actor_id: caller.user_id,
    action,
    target_type: "orders",
    target_id: order.id,
    details: { order_number: order.order_number, ...details },
  });
}

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, "shipped_at" | "delivered_at" | "cancelled_at">> = {
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "change an order status");
  if (!auth.ok) return auth;
  const parsed = update_order_status_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, status, is_restock } = parsed.data;

  try {
    const pb = await createAdminPocketBase();
    const order = await loadOrder(pb, id);
    if (!order) return fail("not_found");
    if (!canTransition(order.status, status)) return fail("invalid_transition");

    const batch = pb.createBatch();
    const timestamp = STATUS_TIMESTAMP[status];
    batch.collection("orders").update(id, { status, ...(timestamp ? { [timestamp]: new Date().toISOString() } : {}) });
    batch.collection("order_events").create({
      order: id,
      type: "status_changed",
      from_status: order.status,
      to_status: status,
      actor: auth.caller.user_id,
      is_customer_visible: true,
    });
    if (status === "cancelled" && is_restock) await addRestock(pb, batch, id);
    await batch.send();

    await log(auth.caller, "change an order status", order, { from: order.status, to: status, is_restock });
    return ok(null);
  } catch (error) {
    await reportError("orders", "updateOrderStatus", error);
    return fail("generic");
  }
}

// Cash on delivery: the courier collected the money.
export async function markOrderPaid(input: OrderIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "mark an order as paid");
  if (!auth.ok) return auth;
  const parsed = order_id_input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const order = await loadOrder(pb, parsed.data.id);
    if (!order) return fail("not_found");
    if (!canMarkPaid(order.status, order.payment_status)) return fail("invalid_transition");

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
      actor: auth.caller.user_id,
      is_customer_visible: true,
    });
    await batch.send();

    await log(auth.caller, "mark an order as paid", order, { total: order.total });
    return ok(null);
  } catch (error) {
    await reportError("orders", "markOrderPaid", error);
    return fail("generic");
  }
}

// Records a refund made outside the app (cash or bank transfer). With Stripe connected this
// would also call the provider.
export async function refundOrder(input: RefundOrderInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.refund", "refund an order");
  if (!auth.ok) return auth;
  const parsed = refund_order_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const order = await loadOrder(pb, parsed.data.id);
    if (!order) return fail("not_found");
    if (!canRefund(order.status, order.payment_status)) return fail("invalid_transition");

    const paid = await pb
      .collection("payments")
      .getFirstListItem(pb.filter('order = {:id} && status = "succeeded"', { id: order.id }))
      .catch(() => null);

    const batch = pb.createBatch();
    batch.collection("orders").update(order.id, { status: "refunded", payment_status: "refunded" });
    if (paid) batch.collection("payments").update(paid.id, { status: "refunded" });
    batch.collection("order_events").create({
      order: order.id,
      type: "payment_status_changed",
      from_status: order.payment_status,
      to_status: "refunded",
      actor: auth.caller.user_id,
      is_customer_visible: true,
    });
    if (parsed.data.is_restock && order.status !== "cancelled") await addRestock(pb, batch, order.id);
    await batch.send();

    await log(auth.caller, "refund an order", order, { total: order.total, is_restock: parsed.data.is_restock });
    return ok(null);
  } catch (error) {
    await reportError("orders", "refundOrder", error);
    return fail("generic");
  }
}

export async function updateTracking(input: UpdateTrackingInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "update order tracking");
  if (!auth.ok) return auth;
  const parsed = update_tracking_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, carrier, tracking_number, tracking_url, is_mark_shipped } = parsed.data;

  try {
    const pb = await createAdminPocketBase();
    const order = await loadOrder(pb, id);
    if (!order) return fail("not_found");
    const will_ship = is_mark_shipped && canTransition(order.status, "shipped");

    const batch = pb.createBatch();
    batch.collection("orders").update(id, {
      carrier,
      tracking_number,
      tracking_url,
      ...(will_ship ? { status: "shipped", shipped_at: new Date().toISOString() } : {}),
    });
    batch.collection("order_events").create({
      order: id,
      type: will_ship ? "shipped" : "note",
      from_status: will_ship ? order.status : "",
      to_status: will_ship ? "shipped" : "",
      message: [carrier, tracking_number].filter(Boolean).join(" · "),
      actor: auth.caller.user_id,
      // A tracking update without shipping is internal bookkeeping.
      is_customer_visible: will_ship,
    });
    await batch.send();

    await log(auth.caller, "update order tracking", order, { carrier, tracking_number, will_ship });
    return ok(null);
  } catch (error) {
    await reportError("orders", "updateTracking", error);
    return fail("generic");
  }
}

export async function addOrderNote(input: AddOrderNoteInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "add an order note");
  if (!auth.ok) return auth;
  const parsed = add_order_note_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const order = await loadOrder(pb, parsed.data.id);
    if (!order) return fail("not_found");
    await pb.collection("order_events").create({
      order: order.id,
      type: "note",
      message: parsed.data.message,
      actor: auth.caller.user_id,
      is_customer_visible: parsed.data.is_customer_visible,
    });
    return ok(null);
  } catch (error) {
    await reportError("orders", "addOrderNote", error);
    return fail("generic");
  }
}

export async function updateInternalNote(input: UpdateInternalNoteInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "update an order's internal note");
  if (!auth.ok) return auth;
  const parsed = update_internal_note_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const order = await loadOrder(pb, parsed.data.id);
    if (!order) return fail("not_found");
    await pb.collection("orders").update(order.id, { internal_note: parsed.data.internal_note });
    return ok(null);
  } catch (error) {
    await reportError("orders", "updateInternalNote", error);
    return fail("generic");
  }
}
