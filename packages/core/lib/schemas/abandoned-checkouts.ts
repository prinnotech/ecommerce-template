import { z } from "zod";

// Orders → Abandoned checkouts.

// A checkout counts as abandoned this long after the customer typed their email.
export const ABANDONED_AFTER_MS = 60 * 60 * 1000;
// The recovery link keeps the checkout open this long.
export const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// The automatic email only looks this far back.
export const AUTOMATIC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const abandoned_checkout_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  recovery: z.enum(["all", "not_sent", "sent"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type AbandonedCheckoutFilters = z.infer<typeof abandoned_checkout_filters_schema>;
