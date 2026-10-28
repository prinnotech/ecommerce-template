import { z } from "zod";

import { LOCALES } from "@/i18nConfig";
import { address_fields_schema } from "@/lib/schemas/account";
import { email_schema } from "@/lib/schemas/auth";

const id_schema = z.string().regex(/^[a-z0-9]{15}$/);

export const cart_lines_schema = z
  .array(z.object({ variant_id: id_schema, quantity: z.number().int().min(1).max(20) }))
  .min(1)
  .max(50);
export type CartLinesInput = z.infer<typeof cart_lines_schema>;

export const create_checkout_schema = z.object({ lines: cart_lines_schema, locale: z.enum(LOCALES) });
export type CreateCheckoutInput = z.infer<typeof create_checkout_schema>;

export const PAYMENT_METHODS = ["card", "cash_on_delivery"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const quote_checkout_schema = z.object({
  session_id: id_schema,
  shipping_method: z.string().max(50),
  payment_method: z.enum(PAYMENT_METHODS),
  // "" removes the code.
  discount_code: z.string().trim().toUpperCase().max(50),
});
export type QuoteCheckoutInput = z.infer<typeof quote_checkout_schema>;

// Phone is optional for card, required for cash on delivery (the courier calls before delivering).
export const complete_checkout_schema = z
  .object({
    session_id: id_schema,
    email: email_schema,
    shipping_address: address_fields_schema,
    is_billing_same: z.boolean(),
    billing_address: address_fields_schema.nullable(),
    shipping_method: z.string("required").min(1, "required").max(50),
    payment_method: z.enum(PAYMENT_METHODS),
    discount_code: z.string().trim().toUpperCase().max(50),
    customer_note: z.string().trim().max(2000, "too_long"),
    // The total the customer saw; the order is refused if the server's total differs.
    expected_total: z.number().int().min(0),
  })
  .refine((value) => value.payment_method !== "cash_on_delivery" || value.shipping_address.phone.length > 0, {
    message: "phone_required",
    path: ["shipping_address", "phone"],
  })
  .refine((value) => value.is_billing_same || value.billing_address !== null, {
    message: "required",
    path: ["billing_address"],
  });
export type CompleteCheckoutInput = z.infer<typeof complete_checkout_schema>;

// Client-side only: format checks for the placeholder card form. Card data never leaves the browser.
export function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function isValidExpiry(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 1) > now;
}
