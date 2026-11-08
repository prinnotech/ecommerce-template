import { z } from "zod";

import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";

// Payment methods (Settings → Payments): a list the owner builds, like Shopify's.
// - stripe: cards (and Apple Pay / Google Pay) through Stripe Checkout; at most one.
// - cash_on_delivery: paid to the courier; at most one.
// - manual: bank transfer, PayPal.me, pay in store… any number; the order waits as "unpaid"
//   until staff mark it paid.
// Orders keep the method's id in `payment_method`; the order's `cod_fee` column holds the
// method's fee (any method can have one).

export const PAYMENT_TYPES = ["stripe", "cash_on_delivery", "manual"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const MAX_PAYMENT_METHODS = 20;

export const payment_method_id_schema = z.string().regex(/^[a-z0-9_]{1,40}$/);

export const payment_method_schema = z.object({
  id: payment_method_id_schema,
  type: z.enum(PAYMENT_TYPES),
  is_enabled: z.boolean(),
  // What the customer sees at checkout.
  name: localized_text_schema,
  // Manual and cash on delivery: shown at checkout, on the thank-you page and in the confirmation
  // email (bank details, how to pay…).
  instructions: localized_text_schema,
  // Extra charge in cents for choosing this method (0 = none).
  fee: z.number().int().min(0).max(100_000_00),
});
export type PaymentMethodConfig = z.infer<typeof payment_method_schema>;

const text = (en: string, es: string, it: string): LocalizedText => ({ en, es, it });

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: "cash_on_delivery",
    type: "cash_on_delivery",
    is_enabled: true,
    name: text("Cash on delivery", "Contra reembolso", "Contrassegno"),
    instructions: text(
      "Pay the courier when your order arrives.",
      "Paga al repartidor cuando llegue tu pedido.",
      "Paghi il corriere alla consegna dell'ordine.",
    ),
    fee: 0,
  },
  {
    id: "stripe",
    type: "stripe",
    is_enabled: false,
    name: text("Card", "Tarjeta", "Carta"),
    instructions: {},
    fee: 0,
  },
];

// Before payment methods were a list, the setting was { card, cash_on_delivery } plus a separate
// COD_FEE. The old card option was a placeholder, so it becomes a disabled Stripe method.
export function paymentMethodsFromLegacy(raw: unknown, cod_fee: unknown): PaymentMethodConfig[] | null {
  const legacy = z.object({ card: z.boolean(), cash_on_delivery: z.boolean() }).safeParse(raw);
  if (!legacy.success) return null;
  const fee = z.number().int().min(0).safeParse(cod_fee);
  return DEFAULT_PAYMENT_METHODS.map((method) =>
    method.type === "cash_on_delivery"
      ? { ...method, is_enabled: legacy.data.cash_on_delivery, fee: fee.success ? fee.data : 0 }
      : method,
  );
}

export const payment_methods_schema = z
  .array(payment_method_schema)
  .max(MAX_PAYMENT_METHODS)
  .refine((methods) => new Set(methods.map((method) => method.id)).size === methods.length, "invalid")
  .refine((methods) => methods.filter((method) => method.type === "stripe").length <= 1, "invalid")
  .refine((methods) => methods.filter((method) => method.type === "cash_on_delivery").length <= 1, "invalid");
