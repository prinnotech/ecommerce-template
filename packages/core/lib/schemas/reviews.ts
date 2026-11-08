import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";

// Product reviews: only signed-in customers who bought the product, one each, shown after staff
// approve them (Products → Reviews).

export const REVIEW_STATUSES = ["pending", "approved", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const review_input_schema = z.object({
  product_id: id_schema,
  rating: z.number().int().min(1, "required").max(5),
  title: z.string().trim().max(120, "too_long"),
  body: z.string().trim().min(10, "too_short").max(4000, "too_long"),
  // The name shown with the review (the account name by default).
  author_name: z.string().trim().min(1, "required").max(80, "too_long"),
});
export type ReviewInput = z.infer<typeof review_input_schema>;

export const review_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...REVIEW_STATUSES]).catch("pending"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ReviewFilters = z.infer<typeof review_filters_schema>;

export const review_reply_schema = z.object({ id: id_schema, reply: z.string().trim().max(2000) });
