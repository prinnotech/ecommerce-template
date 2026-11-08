import type { OrderStatus, PaymentStatus } from "@repo/core/lib/orders";

// Shopify's badge tones: attention = needs action (unpaid, unfulfilled), success = done,
// info = in progress, critical = failed, neutral = closed or archived. Shared by the admin's
// StatusBadge and the shop's order badges, so both show an order the same way.
export type StatusTone = "attention" | "success" | "info" | "critical" | "neutral";

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  attention: "bg-warning text-warning-foreground",
  success: "bg-success text-success-foreground",
  info: "bg-info text-info-foreground",
  critical: "bg-destructive/12 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

// The dot before the label, so the state isn't shown by color alone (hollow = open, filled = done).
export const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  attention: "border-warning-foreground",
  success: "border-success-foreground bg-success-foreground",
  info: "border-info-foreground",
  critical: "border-destructive bg-destructive",
  neutral: "border-muted-foreground",
};

export const ORDER_TONE: Record<OrderStatus, StatusTone> = {
  pending: "attention",
  paid: "info",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
  refunded: "neutral",
};

export const PAYMENT_TONE: Record<PaymentStatus, StatusTone> = {
  unpaid: "attention",
  paid: "success",
  failed: "critical",
  partially_refunded: "attention",
  refunded: "neutral",
};
