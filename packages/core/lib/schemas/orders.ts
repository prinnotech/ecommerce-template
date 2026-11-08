import { z } from "zod";

import { ORDER_STATUSES } from "@repo/core/lib/orders";
import { bulk_ids_schema } from "@repo/core/lib/schemas/admin";
import { id_schema } from "@repo/core/lib/schemas/ids";

export const order_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "open", "archived", ...ORDER_STATUSES]).catch("all"),
  payment: z.enum(["all", "unpaid", "paid", "refunded"]).catch("all"),
  sort: z.enum(["created_at", "order_number", "total"]).catch("created_at"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type OrderListFilters = z.infer<typeof order_list_filters_schema>;

export const update_order_status_schema = z.object({
  id: id_schema,
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
  // Cancelling puts the items back in stock unless the admin says otherwise.
  is_restock: z.boolean(),
});
export type UpdateOrderStatusInput = z.infer<typeof update_order_status_schema>;

export const order_id_input_schema = z.object({ id: id_schema });
export type OrderIdInput = z.infer<typeof order_id_input_schema>;

// Items (with how many of each) and/or an amount. The amount is checked against what's left.
export const refund_order_schema = z.object({
  id: id_schema,
  amount: z.number().int().min(1).max(100_000_000),
  lines: z.array(z.object({ item_id: id_schema, quantity: z.number().int().min(1).max(999) })).max(200),
  reason: z.string().trim().max(500),
  // Put the refunded items back in stock.
  is_restock: z.boolean(),
  // Email the customer (order_refunded).
  is_notify: z.boolean(),
});
export type RefundOrderInput = z.infer<typeof refund_order_schema>;

export const update_tracking_schema = z.object({
  id: id_schema,
  carrier: z.string().trim().max(100, "too_long"),
  tracking_number: z.string().trim().max(100, "too_long"),
  tracking_url: z.union([z.url("invalid"), z.literal("")]),
  // Also move the order to "shipped" (when allowed).
  is_mark_shipped: z.boolean(),
});
export type UpdateTrackingInput = z.infer<typeof update_tracking_schema>;

export const add_order_note_schema = z.object({
  id: id_schema,
  message: z.string().trim().min(1, "required").max(2000, "too_long"),
  is_customer_visible: z.boolean(),
});
export type AddOrderNoteInput = z.infer<typeof add_order_note_schema>;

export const update_internal_note_schema = z.object({ id: id_schema, internal_note: z.string().trim().max(5000) });
export type UpdateInternalNoteInput = z.infer<typeof update_internal_note_schema>;

export const DASHBOARD_RANGES = ["7", "30", "90"] as const;
export const dashboard_range_schema = z.enum(DASHBOARD_RANGES).catch("30");
export type DashboardRange = z.infer<typeof dashboard_range_schema>;

// Bulk "Mark as fulfilled" from the orders list (each order still follows the lifecycle rules).
export const bulk_orders_schema = z.object({ ids: bulk_ids_schema });
export type BulkOrdersInput = z.infer<typeof bulk_orders_schema>;
