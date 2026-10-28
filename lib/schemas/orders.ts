import { z } from "zod";

import { ORDER_STATUSES } from "@/lib/orders";

const id_schema = z.string().regex(/^[a-z0-9]{15}$/);

export const order_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "open", ...ORDER_STATUSES]).catch("all"),
  payment: z.enum(["all", "unpaid", "paid", "refunded"]).catch("all"),
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

export const refund_order_schema = z.object({ id: id_schema, is_restock: z.boolean() });
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
