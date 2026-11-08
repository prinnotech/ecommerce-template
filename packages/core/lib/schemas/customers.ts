import { z } from "zod";

import { ID_PATTERN, id_schema } from "@repo/core/lib/schemas/ids";

// A customer is a registered user (key = user id) or a guest who checked out without an account
// (key = "g" + the id of one of their orders, so the address bar never shows an email).
export const customer_key_schema = z.string().regex(new RegExp(`^g?${ID_PATTERN.source.slice(1)}`));

export const customer_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  // "subscribed" = accepts marketing emails (Shopify's "Email subscribers" view).
  type: z.enum(["all", "registered", "guest", "subscribed"]).catch("all"),
  sort: z.enum(["last_order", "total_spent", "order_count", "created_at"]).catch("last_order"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type CustomerListFilters = z.infer<typeof customer_list_filters_schema>;

export const customer_note_schema = z.object({
  key: customer_key_schema,
  note: z.string().trim().max(5000, "too_long"),
});
export type CustomerNoteInput = z.infer<typeof customer_note_schema>;

export const customer_marketing_schema = z.object({ user_id: id_schema, accepts_marketing: z.boolean() });
export type CustomerMarketingInput = z.infer<typeof customer_marketing_schema>;
