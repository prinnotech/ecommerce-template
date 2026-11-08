import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { address_fields_schema } from "@repo/core/lib/schemas/account";
import { id_schema } from "@repo/core/lib/schemas/ids";

// Orders → Drafts: orders made by staff (phone orders, wholesale, a custom item), invoiced or
// marked paid, then turned into real orders.

export const DRAFT_STATUSES = ["open", "invoice_sent", "completed"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const MAX_DRAFT_LINES = 100;
const cents_schema = z.number().int().min(0).max(100_000_000);

// A product variant (priced from the catalog) or a custom line (title and price typed in).
export const draft_line_schema = z.union([
  z.object({ variant_id: id_schema, quantity: z.number().int().min(1).max(999) }),
  z.object({
    variant_id: z.literal(""),
    title: z.string().trim().min(1).max(200),
    unit_price: cents_schema,
    quantity: z.number().int().min(1).max(999),
  }),
]);
export type DraftLineInput = z.infer<typeof draft_line_schema>;

export const draft_discount_schema = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1).max(100_000_000),
  reason: z.string().trim().max(200).catch(""),
});
export type DraftDiscount = z.infer<typeof draft_discount_schema>;

export const draft_fields_schema = z
  .object({
    user_id: z.union([id_schema, z.literal("")]),
    email: z.union([z.email(), z.literal("")]),
    customer_name: z.string().trim().max(200),
    phone: z.string().trim().max(50),
    locale: z.enum(LOCALES),
    lines: z.array(draft_line_schema).max(MAX_DRAFT_LINES),
    shipping_address: address_fields_schema.nullable(),
    shipping_method: z.string().max(50),
    // null = the shipping method's price (and the free-shipping offer).
    shipping_price: cents_schema.nullable(),
    discount: draft_discount_schema.nullable(),
    note: z.string().trim().max(2000),
  })
  .refine((draft) => draft.discount?.type !== "percent" || draft.discount.value <= 100, { path: ["discount"] });
export type DraftFieldsInput = z.input<typeof draft_fields_schema>;
export type DraftFields = z.infer<typeof draft_fields_schema>;

export const save_draft_schema = z.object({ id: id_schema, draft: draft_fields_schema });

export const draft_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...DRAFT_STATUSES]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type DraftListFilters = z.infer<typeof draft_list_filters_schema>;

export const complete_draft_schema = z.object({ id: id_schema, is_paid: z.boolean() });
