import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";

// Marketing → Discounts: codes typed at checkout.

export const DISCOUNT_TYPES = ["percent", "fixed", "free_shipping"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_STATUSES = ["active", "scheduled", "expired", "used_up", "disabled"] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

// Which products the discount lowers. "all" = the whole order.
export const applies_to_schema = z.object({
  kind: z.enum(["all", "products", "categories"]),
  ids: z.array(id_schema).max(200),
});
export type DiscountAppliesTo = z.infer<typeof applies_to_schema>;
export const APPLIES_TO_ALL: DiscountAppliesTo = { kind: "all", ids: [] };

const iso_or_empty = z.union([z.iso.datetime({ offset: true }), z.literal("")]);

export const discount_input_schema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,50}$/, "invalid_code"),
    // Internal name ("Summer sale"); empty = the code.
    title: z.string().trim().max(120),
    type: z.enum(DISCOUNT_TYPES),
    // Percent (1-100) or cents; 0 for free shipping.
    value: z.number().int().min(0).max(100_000_000),
    min_subtotal: z.number().int().min(0).max(100_000_000),
    starts_at: iso_or_empty,
    ends_at: iso_or_empty,
    // 0 = no limit.
    usage_limit: z.number().int().min(0).max(1_000_000),
    once_per_customer: z.boolean(),
    is_active: z.boolean(),
    applies_to: applies_to_schema,
  })
  .refine((input) => input.type !== "percent" || (input.value >= 1 && input.value <= 100), { path: ["value"] })
  .refine((input) => input.type !== "fixed" || input.value >= 1, { path: ["value"] })
  .refine((input) => input.applies_to.kind === "all" || input.applies_to.ids.length > 0, { path: ["applies_to"] })
  .refine((input) => !input.starts_at || !input.ends_at || input.starts_at < input.ends_at, { path: ["ends_at"] });
export type DiscountInput = z.infer<typeof discount_input_schema>;

export const discount_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...DISCOUNT_STATUSES]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type DiscountListFilters = z.infer<typeof discount_list_filters_schema>;

type StatusFields = {
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  usage_limit: number;
  used_count: number;
};

// One status for the list badge, in priority order.
export function discountStatus(discount: StatusFields, now = Date.now()): DiscountStatus {
  if (!discount.is_active) return "disabled";
  if (discount.ends_at && new Date(discount.ends_at).getTime() < now) return "expired";
  if (discount.usage_limit > 0 && discount.used_count >= discount.usage_limit) return "used_up";
  if (discount.starts_at && new Date(discount.starts_at).getTime() > now) return "scheduled";
  return "active";
}

// A readable random code: no 0/O or 1/I to mix up.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateDiscountCode(length = 10): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}
