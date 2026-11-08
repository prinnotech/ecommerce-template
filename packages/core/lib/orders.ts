// Order lifecycle rules, shared by the dashboard (which buttons to show) and the
// actions (which changes to accept). Payment status moves separately from fulfillment.

// How a refund of `amount` splits: first the money paid with the payment method, then the part paid
// with a gift card, which goes back onto the card. Earlier refunds used up the money part first too.
export function splitRefund(
  order: { total: number; gift_card_total: number; refunded_total: number },
  amount: number,
): { money: number; gift_card: number } {
  const money_left = Math.max(0, order.total - order.gift_card_total - order.refunded_total);
  const money = Math.min(amount, money_left);
  return { money, gift_card: amount - money };
}

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// partially_refunded: some money went back, the rest is still the store's (Refund dialog).
export const PAYMENT_STATUSES = ["unpaid", "paid", "failed", "partially_refunded", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// A single payment attempt (separate from the order's overall payment status).
export const PAYMENT_RECORD_STATUSES = ["pending", "succeeded", "failed", "refunded"] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

// The id of a payment method from Settings → Payments ("stripe", "cash_on_delivery", a manual
// method's id…). Orders from before the list existed may say "card".
export type PaymentMethod = string;

// Timeline entries on an order.
export const ORDER_EVENT_TYPES = [
  "created",
  "status_changed",
  "payment_status_changed",
  "note",
  "shipped",
  "email_sent",
  "refund",
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

// Fulfillment moves forward only. "refunded" is reached through refundOrder, not here.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "shipped", "cancelled"],
  paid: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

// Cash on delivery is marked paid by hand once the courier has collected it.
export function canMarkPaid(status: OrderStatus, payment_status: PaymentStatus): boolean {
  return payment_status === "unpaid" && status !== "cancelled" && status !== "refunded";
}

export function canRefund(status: OrderStatus, payment_status: PaymentStatus): boolean {
  return (payment_status === "paid" || payment_status === "partially_refunded") && status !== "refunded";
}

// Orders that still need work from the store.
export const OPEN_STATUSES: OrderStatus[] = ["pending", "paid", "processing"];

// Closed orders (delivered, cancelled, refunded): the "Archived" view on the orders list.
export const ARCHIVED_STATUSES: OrderStatus[] = ["delivered", "cancelled", "refunded"];

// Orders that count as sales in reports.
export function countsAsSale(status: OrderStatus): boolean {
  return status !== "cancelled" && status !== "refunded";
}
