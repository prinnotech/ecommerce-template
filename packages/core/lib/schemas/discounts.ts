import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";

// Marketing → Discounts: codes typed at checkout, and automatic discounts applied without one.

export const DISCOUNT_TYPES = ["percent", "fixed", "free_shipping", "buy_x_get_y"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_METHODS = ["code", "automatic"] as const;
export type DiscountMethod = (typeof DISCOUNT_METHODS)[number];

// What a discount lowers, for "combines with": product lines, the order subtotal, or shipping.
export const DISCOUNT_CLASSES = ["product", "order", "shipping"] as const;
export type DiscountClass = (typeof DISCOUNT_CLASSES)[number];

export const DISCOUNT_STATUSES = ["active", "scheduled", "expired", "used_up", "disabled"] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

// Which products the discount lowers. "all" = the whole order.
export const applies_to_schema = z.object({
  kind: z.enum(["all", "products", "categories"]),
  ids: z.array(id_schema).max(200),
});
export type DiscountAppliesTo = z.infer<typeof applies_to_schema>;
export const APPLIES_TO_ALL: DiscountAppliesTo = { kind: "all", ids: [] };

// Buy X get Y: buy `buy.value` items (or spend `buy.value` cents) from `buy.applies_to`, and
// `get.quantity` items from `get.applies_to` are `get.percent` % off (100 = free), the cheapest
// first. `max_uses` = how many times per order (0 = as often as the cart allows).
export const buy_x_get_y_schema = z.object({
  buy: z.object({
    kind: z.enum(["quantity", "amount"]),
    value: z.number().int().min(1).max(100_000_000),
    applies_to: applies_to_schema,
  }),
  get: z.object({
    quantity: z.number().int().min(1).max(100),
    percent: z.number().int().min(1).max(100),
    applies_to: applies_to_schema,
  }),
  max_uses: z.number().int().min(0).max(100),
});
export type BuyXGetY = z.infer<typeof buy_x_get_y_schema>;
export const DEFAULT_BUY_X_GET_Y: BuyXGetY = {
  buy: { kind: "quantity", value: 2, applies_to: APPLIES_TO_ALL },
  get: { quantity: 1, percent: 100, applies_to: APPLIES_TO_ALL },
  max_uses: 1,
};

export const combines_with_schema = z.object({ product: z.boolean(), order: z.boolean(), shipping: z.boolean() });
export type CombinesWith = z.infer<typeof combines_with_schema>;
export const COMBINES_WITH_NONE: CombinesWith = { product: false, order: false, shipping: false };

// The class a discount belongs to: free shipping is shipping, Buy X get Y and discounts limited to
// products or categories are product discounts, the rest are order discounts.
export function discountClass(discount: { type: DiscountType; applies_to: DiscountAppliesTo }): DiscountClass {
  if (discount.type === "free_shipping") return "shipping";
  if (discount.type === "buy_x_get_y" || discount.applies_to.kind !== "all") return "product";
  return "order";
}

const iso_or_empty = z.union([z.iso.datetime({ offset: true }), z.literal("")]);

export const discount_input_schema = z
  .object({
    method: z.enum(DISCOUNT_METHODS),
    // Automatic discounts have no code to type: the action gives them a hidden one ("" here).
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z0-9_-]{3,50})?$/, "invalid_code"),
    // Code discounts: an internal name ("Summer sale"); empty = the code. Automatic discounts:
    // the name customers see in the order summary (required).
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
    buy_x_get_y: buy_x_get_y_schema.nullable(),
    combines_with: combines_with_schema,
  })
  .refine((input) => input.method !== "code" || input.code.length > 0, { path: ["code"] })
  .refine((input) => input.method !== "automatic" || input.title.length > 0, { path: ["title"] })
  .refine((input) => input.type !== "buy_x_get_y" || input.buy_x_get_y !== null, { path: ["buy_x_get_y"] })
  .refine(
    (input) =>
      !input.buy_x_get_y ||
      ((input.buy_x_get_y.buy.applies_to.kind === "all" || input.buy_x_get_y.buy.applies_to.ids.length > 0) &&
        (input.buy_x_get_y.get.applies_to.kind === "all" || input.buy_x_get_y.get.applies_to.ids.length > 0)),
    { path: ["buy_x_get_y"] },
  )
  .refine((input) => input.type !== "percent" || (input.value >= 1 && input.value <= 100), { path: ["value"] })
  .refine((input) => input.type !== "fixed" || input.value >= 1, { path: ["value"] })
  .refine((input) => input.applies_to.kind === "all" || input.applies_to.ids.length > 0, { path: ["applies_to"] })
  .refine((input) => !input.starts_at || !input.ends_at || input.starts_at < input.ends_at, { path: ["ends_at"] });
export type DiscountInput = z.infer<typeof discount_input_schema>;

// Hidden code of an automatic discount (never typed by customers, never accepted at checkout).
export function automaticDiscountCode(): string {
  return `AUTO-${generateDiscountCode(12)}`;
}

export const discount_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  method: z.enum(["all", ...DISCOUNT_METHODS]).catch("all"),
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

// Stored applied_discounts (sessions and orders); anything unreadable counts as none.
const applied_discounts_schema = z
  .array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(DISCOUNT_TYPES),
      amount: z.number().int(),
    }),
  )
  .catch([]);
export function parseAppliedDiscounts(value: unknown): z.infer<typeof applied_discounts_schema> {
  return applied_discounts_schema.parse(value ?? []);
}

// The discounts an order uses up once each: its code and every automatic discount it got.
export function usedDiscountIds(discount_code: string, applied: { id: string }[]): string[] {
  return [...new Set([discount_code, ...applied.map((item) => item.id)].filter(Boolean))];
}
