import type { OrdersPaymentStatusOptions, OrdersStatusOptions } from "@/types/pocketbase-types";

// Order lifecycle rules, shared by the dashboard (which buttons to show) and the
// actions (which changes to accept). Payment status moves separately from fulfillment.

export type OrderStatus = OrdersStatusOptions;
export type PaymentStatus = OrdersPaymentStatusOptions;

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];
export const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "paid", "failed", "refunded"];

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
  return payment_status === "paid" && status !== "refunded";
}

// Orders that still need work from the store.
export const OPEN_STATUSES: OrderStatus[] = ["pending", "paid", "processing"];

// Orders that count as sales in reports.
export function countsAsSale(status: OrderStatus): boolean {
  return status !== "cancelled" && status !== "refunded";
}
