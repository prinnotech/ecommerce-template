"use server";

import { after } from "next/server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, AdminOrderEvent, AdminOrderRow, OrderState, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, type Caller } from "@repo/core/lib/auth";
import { sendOrderEmails } from "@repo/core/lib/email/order-emails";
import type { EmailTemplate } from "@repo/core/lib/email/templates";
import { canMarkPaid, canRefund, canTransition, splitRefund, type OrderStatus } from "@repo/core/lib/orders";
import { refundStripePayment } from "@repo/core/lib/stripe/stripe-orders";
import { toCsv } from "@repo/core/lib/utils/csv";
import { readAdminOrder, readAdminOrders } from "@repo/core/lib/orders-read";
import {
  add_order_note_schema,
  bulk_orders_schema,
  order_id_input_schema,
  order_list_filters_schema,
  refund_order_schema,
  update_internal_note_schema,
  update_order_status_schema,
  update_tracking_schema,
  type AddOrderNoteInput,
  type BulkOrdersInput,
  type OrderIdInput,
  type OrderListFilters,
  type RefundOrderInput,
  type UpdateInternalNoteInput,
  type UpdateOrderStatusInput,
  type UpdateTrackingInput,
} from "@repo/core/lib/schemas/orders";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { issueGiftCardsForOrder } from "@repo/core/lib/gift-cards-server";

// The lifecycle rules (lib/orders.ts) are checked here; the backend applies each change
// atomically together with its timeline event.

export type { AdminOrderDetail, AdminOrderEvent, AdminOrderRow };
export type AdminOrderPage = Page<AdminOrderRow>;

// The customer email for each status an order can be moved to (Settings → Notifications).
const STATUS_EMAIL: Partial<Record<OrderStatus, EmailTemplate>> = {
  shipped: "order_shipped",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
};

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, "shipped_at" | "delivered_at" | "cancelled_at">> = {
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

function log(caller: Caller, action: string, order: OrderState, details: Record<string, unknown>) {
  return logActivity({
    actor_id: caller.user_id,
    action,
    target_type: "orders",
    target_id: order.id,
    details: { order_number: order.order_number, ...details },
  });
}

export async function getAdminOrders(input: Partial<OrderListFilters>): Promise<ActionResult<AdminOrderPage>> {
  return readAdminOrders(input);
}

export async function getAdminOrder(id: string): Promise<ActionResult<AdminOrderDetail>> {
  return readAdminOrder(id);
}

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "change an order status");
  if (!auth.ok) return auth;
  const parsed = update_order_status_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, status, is_restock } = parsed.data;

  try {
    const orders = getBackend().orders;
    const order = await orders.getState(id);
    if (!order) return fail("not_found");
    if (!canTransition(order.status, status)) return fail("invalid_transition");

    await orders.changeStatus(order, status, {
      actor: auth.caller.user_id,
      timestamp_field: STATUS_TIMESTAMP[status] ?? null,
      restock: status === "cancelled" && is_restock,
    });
    await log(auth.caller, "change an order status", order, { from: order.status, to: status, is_restock });
    const template = STATUS_EMAIL[status];
    if (template) await sendOrderEmails(template, { id: order.id });
    return ok(null);
  } catch (error) {
    return failFrom(error, "orders", "updateOrderStatus");
  }
}

// Cash on delivery or a manual method: the money arrived.
export async function markOrderPaid(input: OrderIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "mark an order as paid");
  if (!auth.ok) return auth;
  const parsed = order_id_input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const orders = getBackend().orders;
    const order = await orders.getState(parsed.data.id);
    if (!order) return fail("not_found");
    if (!canMarkPaid(order.status, order.payment_status)) return fail("invalid_transition");

    await orders.markPaid(order, auth.caller.user_id);
    await log(auth.caller, "mark an order as paid", order, { total: order.total });
    await sendOrderEmails("payment_received", { id: order.id });
    // Gift cards bought with this order are issued once it's paid.
    after(() => issueGiftCardsForOrder(order.id));
    return ok(null);
  } catch (error) {
    return failFrom(error, "orders", "markOrderPaid");
  }
}

// Card orders are refunded through Stripe; for other methods this records a refund made outside
// the app (cash or bank transfer). A refund of some items and/or an amount. Everything is checked against what's left: the
// amount against total − refunded so far, each line against its quantity minus earlier refunds.
export async function refundOrder(input: RefundOrderInput): Promise<ActionResult<{ refunded_total: number }>> {
  const auth = await authorize("orders.refund", "refund an order");
  if (!auth.ok) return auth;
  const parsed = refund_order_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { amount, lines, reason, is_restock, is_notify } = parsed.data;

  try {
    const orders = getBackend().orders;
    const order = await orders.getState(parsed.data.id);
    if (!order) return fail("not_found");
    if (!canRefund(order.status, order.payment_status)) return fail("invalid_transition");
    if (amount > order.total - order.refunded_total) return fail("refund_too_large");

    const detail = await orders.get(order.id);
    for (const line of lines) {
      const item = detail.items.find((candidate) => candidate.id === line.item_id);
      const already = detail.refunds
        .flatMap((refund) => refund.lines)
        .filter((refunded) => refunded.item_id === line.item_id)
        .reduce((sum, refunded) => sum + refunded.quantity, 0);
      if (!item || line.quantity > item.quantity - already) return fail("invalid_input");
    }

    const split = splitRefund(detail, amount);
    // The gift card part goes back onto the card that paid it.
    const gift_card_id =
      split.gift_card > 0 && detail.checkout_session_id
        ? ((await getBackend().checkout.getSession(detail.checkout_session_id))?.gift_card_id ?? "")
        : "";
    if (split.gift_card > 0 && !gift_card_id) return fail("refund_too_large");

    const card_payment = detail.payments.find(
      (payment) => payment.provider === "stripe" && payment.status === "succeeded" && payment.provider_ref,
    );
    // Stripe only gets back what it charged.
    if (card_payment && split.money > 0 && !(await refundStripePayment(card_payment.provider_ref, split.money))) {
      return fail("payment_unavailable");
    }

    const result = await orders.refund(order, {
      amount,
      lines,
      reason,
      // A cancelled order's stock was already restocked (or not) when it was cancelled.
      restock: is_restock && order.status !== "cancelled",
      provider_ref: card_payment?.provider_ref ?? "",
      actor: auth.caller.user_id,
    });
    if (gift_card_id) {
      await getBackend().gift_cards.credit(gift_card_id, split.gift_card, {
        order_id: order.id,
        note: `refund #${detail.order_number}`,
      });
    }
    await log(auth.caller, "refund an order", order, {
      amount,
      gift_card: split.gift_card,
      lines: lines.length,
      is_full: result.is_full,
      is_restock,
      is_card: Boolean(card_payment),
    });
    if (is_notify) {
      await sendOrderEmails(
        "order_refunded",
        { id: order.id },
        {
          refund_amount: formatCurrency(amount, order.currency, detail.locale),
        },
      );
    }
    return ok({ refunded_total: result.refunded_total });
  } catch (error) {
    return failFrom(error, "orders", "refundOrder");
  }
}

export async function updateTracking(input: UpdateTrackingInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "update order tracking");
  if (!auth.ok) return auth;
  const parsed = update_tracking_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, carrier, tracking_number, tracking_url, is_mark_shipped } = parsed.data;

  try {
    const orders = getBackend().orders;
    const order = await orders.getState(id);
    if (!order) return fail("not_found");
    const will_ship = is_mark_shipped && canTransition(order.status, "shipped");

    await orders.updateTracking(
      order,
      { carrier, tracking_number, tracking_url },
      { actor: auth.caller.user_id, ship: will_ship },
    );
    await log(auth.caller, "update order tracking", order, { carrier, tracking_number, will_ship });
    if (will_ship) await sendOrderEmails("order_shipped", { id: order.id });
    return ok(null);
  } catch (error) {
    return failFrom(error, "orders", "updateTracking");
  }
}

export async function addOrderNote(input: AddOrderNoteInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "add an order note");
  if (!auth.ok) return auth;
  const parsed = add_order_note_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const orders = getBackend().orders;
    const order = await orders.getState(parsed.data.id);
    if (!order) return fail("not_found");
    await orders.addNote(order.id, {
      message: parsed.data.message,
      is_customer_visible: parsed.data.is_customer_visible,
      actor: auth.caller.user_id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "orders", "addOrderNote");
  }
}

export async function updateInternalNote(input: UpdateInternalNoteInput): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "update an order's internal note");
  if (!auth.ok) return auth;
  const parsed = update_internal_note_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const orders = getBackend().orders;
    const order = await orders.getState(parsed.data.id);
    if (!order) return fail("not_found");
    await orders.setInternalNote(order.id, parsed.data.internal_note);
    return ok(null);
  } catch (error) {
    return failFrom(error, "orders", "updateInternalNote");
  }
}

// ---------- Bulk actions from the orders list ----------

// "Mark as fulfilled" = shipped. Orders that can't be shipped from their status are skipped and
// reported, so one cancelled order doesn't block the rest.
export async function bulkFulfillOrders(
  input: BulkOrdersInput,
): Promise<ActionResult<{ fulfilled: number; skipped: number }>> {
  const auth = await authorize("orders.edit", "fulfill orders");
  if (!auth.ok) return auth;
  const parsed = bulk_orders_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const orders = getBackend().orders;
    let fulfilled = 0;
    for (const id of parsed.data.ids) {
      const order = await orders.getState(id);
      if (!order || !canTransition(order.status, "shipped")) continue;
      await orders.changeStatus(order, "shipped", {
        actor: auth.caller.user_id,
        timestamp_field: "shipped_at",
        restock: false,
      });
      await log(auth.caller, "fulfill an order", order, { from: order.status, to: "shipped" });
      await sendOrderEmails("order_shipped", { id: order.id });
      fulfilled++;
    }
    return ok({ fulfilled, skipped: parsed.data.ids.length - fulfilled });
  } catch (error) {
    return failFrom(error, "orders", "bulkFulfillOrders");
  }
}

const EXPORT_PAGE_SIZE = 250;
const EXPORT_MAX_ROWS = 10_000;

// The orders matching the list's current filters, as CSV text (the browser saves it as a file).
export async function exportOrdersCsv(input: Partial<OrderListFilters>): Promise<ActionResult<string>> {
  const auth = await authorize("orders.view", "export orders");
  if (!auth.ok) return auth;
  const filters = order_list_filters_schema.parse(input);

  try {
    const orders = getBackend().orders;
    const rows: AdminOrderRow[] = [];
    for (let page = 1; rows.length < EXPORT_MAX_ROWS; page++) {
      const result = await orders.list({ ...filters, page }, EXPORT_PAGE_SIZE);
      rows.push(...result.items);
      if (page >= result.total_pages) break;
    }
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "export orders",
      target_type: "orders",
      details: { count: rows.length, filters },
    });
    return ok(
      toCsv([
        ["order", "date", "customer", "email", "status", "payment", "payment_method", "items", "total", "currency"],
        ...rows.map((row) => [
          String(row.order_number),
          row.created_at,
          row.customer_name,
          row.email,
          row.status,
          row.payment_status,
          row.payment_method,
          String(row.item_count),
          (row.total / 100).toFixed(2),
          row.currency,
        ]),
      ]),
    );
  } catch (error) {
    return failFrom(error, "orders", "exportOrdersCsv");
  }
}
