import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { address_fields_schema } from "@repo/core/lib/schemas/account";
import { email_schema } from "@repo/core/lib/schemas/auth";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { payment_method_id_schema } from "@repo/core/lib/schemas/payments";
import { COUNTRY_CODES } from "@repo/core/lib/locale/countries";

export const cart_lines_schema = z
  .array(z.object({ variant_id: id_schema, quantity: z.number().int().min(1).max(20) }))
  .min(1)
  .max(50);
export type CartLinesInput = z.infer<typeof cart_lines_schema>;

export const create_checkout_schema = z.object({ lines: cart_lines_schema, locale: z.enum(LOCALES) });
export type CreateCheckoutInput = z.infer<typeof create_checkout_schema>;

export const quote_checkout_schema = z.object({
  session_id: id_schema,
  shipping_method: z.string().max(50),
  payment_method: payment_method_id_schema,
  // "" removes the code. A gift card code typed in the same field is recognised.
  discount_code: z.string().trim().toUpperCase().max(50),
  // The gift card already applied ("" = none).
  gift_card_code: z.string().trim().toUpperCase().max(40).catch(""),
  // The delivery country typed so far ("" = not chosen): picks the zone's rates and tax.
  country: z.union([z.enum(COUNTRY_CODES), z.literal("")]).catch(""),
});
export type QuoteCheckoutInput = z.infer<typeof quote_checkout_schema>;

// The phone is required for cash on delivery (the courier calls before delivering): the action
// checks it, since only the server knows which type the chosen method is.
export const complete_checkout_schema = z
  .object({
    session_id: id_schema,
    email: email_schema,
    shipping_address: address_fields_schema,
    is_billing_same: z.boolean(),
    billing_address: address_fields_schema.nullable(),
    shipping_method: z.string("required").min(1, "required").max(50),
    payment_method: payment_method_id_schema,
    discount_code: z.string().trim().toUpperCase().max(50),
    gift_card_code: z.string().trim().toUpperCase().max(40).catch(""),
    customer_note: z.string().trim().max(2000, "too_long"),
    // The total the customer saw; the order is refused if the server's total differs.
    expected_total: z.number().int().min(0),
  })
  .refine((value) => value.is_billing_same || value.billing_address !== null, {
    message: "required",
    path: ["billing_address"],
  });
export type CompleteCheckoutInput = z.infer<typeof complete_checkout_schema>;
