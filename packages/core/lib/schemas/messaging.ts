import { z } from "zod";

import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";

// Settings → SMS & WhatsApp (the MESSAGING setting; the Twilio auth token is an encrypted secret,
// lib/secrets.ts). Messages go out through Twilio for the events below.

export const MESSAGE_EVENTS = [
  "order_confirmation",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "order_refunded",
  "staff_new_order",
  "staff_low_stock",
] as const;
export type MessageEvent = (typeof MESSAGE_EVENTS)[number];

// Sent to the staff phone numbers; the others go to the customer, only if they ticked the box at
// checkout.
export const STAFF_MESSAGE_EVENTS: readonly MessageEvent[] = ["staff_new_order", "staff_low_stock"];

export function isMessageEvent(value: string): value is MessageEvent {
  return (MESSAGE_EVENTS as readonly string[]).includes(value);
}

export const MESSAGE_PLACEHOLDERS = [
  "store_name",
  "customer_name",
  "order_number",
  "order_total",
  "order_link",
  "payment_method",
  "shipping_method",
  "tracking_number",
  "tracking_link",
  "carrier",
  "refund_amount",
  // staff_low_stock
  "product_name",
  "stock_left",
] as const;
export type MessagePlaceholder = (typeof MESSAGE_PLACEHOLDERS)[number];

// Placeholders that mean something for each event (shown under its text box).
export const EVENT_PLACEHOLDERS: Record<MessageEvent, readonly MessagePlaceholder[]> = {
  order_confirmation: ["store_name", "customer_name", "order_number", "order_total", "order_link", "payment_method"],
  order_shipped: ["store_name", "customer_name", "order_number", "tracking_number", "tracking_link", "carrier"],
  order_delivered: ["store_name", "customer_name", "order_number", "order_link"],
  order_cancelled: ["store_name", "customer_name", "order_number"],
  order_refunded: ["store_name", "customer_name", "order_number", "refund_amount"],
  staff_new_order: ["order_number", "order_total", "customer_name", "payment_method", "shipping_method", "order_link"],
  staff_low_stock: ["product_name", "stock_left"],
};

// E.164: + and 7 to 15 digits.
export const E164 = /^\+[1-9]\d{6,14}$/;
// Twilio ids: AC… (account), MG… (Messaging Service), HX… (Content template).
const twilioSid = (prefix: string) => new RegExp(`^(${prefix}[0-9a-fA-F]{32})?$`);

export const message_event_schema = z.object({
  sms: z.boolean(),
  whatsapp: z.boolean(),
  sms_text: localized_text_schema,
  // WhatsApp messages the store starts must use a template Meta approved (Twilio Content).
  whatsapp_content_sid: z.string().trim().regex(twilioSid("HX"), "invalid_content_sid"),
  // What fills the template's variables {{1}}, {{2}}… in order.
  whatsapp_variables: z.array(z.enum(MESSAGE_PLACEHOLDERS)).max(10),
});
export type MessageEventSettings = z.infer<typeof message_event_schema>;

export const messaging_schema = z.object({
  account_sid: z.string().trim().regex(twilioSid("AC"), "invalid_account_sid"),
  // A phone number (+…) or a Messaging Service (MG…).
  sms_from: z
    .string()
    .trim()
    .refine((value) => !value || E164.test(value) || twilioSid("MG").test(value), "invalid_sender"),
  // The WhatsApp-enabled number (+…).
  whatsapp_from: z
    .string()
    .trim()
    .refine((value) => !value || E164.test(value), "invalid_sender"),
  // Added to customer numbers typed without one (+39 → 333 123 4567 becomes +393331234567).
  default_country_code: z
    .string()
    .trim()
    .regex(/^(\+[1-9]\d{0,3})?$/, "invalid_country_code"),
  staff_phones: z.array(z.string().trim().regex(E164, "invalid_phone")).max(10),
  events: z.partialRecord(z.enum(MESSAGE_EVENTS), message_event_schema),
});
export type MessagingSettings = z.infer<typeof messaging_schema>;

const text = (en: string, es: string, it: string): LocalizedText => ({ en, es, it });

function defaults(sms_text: LocalizedText): MessageEventSettings {
  return { sms: false, whatsapp: false, sms_text, whatsapp_content_sid: "", whatsapp_variables: [] };
}

export const DEFAULT_MESSAGE_EVENTS: Record<MessageEvent, MessageEventSettings> = {
  order_confirmation: defaults(
    text(
      "{{store_name}}: thanks for your order #{{order_number}} ({{order_total}}). We'll text you when it ships.\n{{order_link}}",
      "{{store_name}}: gracias por tu pedido n.º {{order_number}} ({{order_total}}). Te avisaremos cuando salga.\n{{order_link}}",
      "{{store_name}}: grazie per il tuo ordine n. {{order_number}} ({{order_total}}). Ti avviseremo alla spedizione.\n{{order_link}}",
    ),
  ),
  order_shipped: defaults(
    text(
      "{{store_name}}: your order #{{order_number}} is on its way.\nTracking: {{tracking_number}}\n{{tracking_link}}",
      "{{store_name}}: tu pedido n.º {{order_number}} está en camino.\nSeguimiento: {{tracking_number}}\n{{tracking_link}}",
      "{{store_name}}: il tuo ordine n. {{order_number}} è in viaggio.\nTracking: {{tracking_number}}\n{{tracking_link}}",
    ),
  ),
  order_delivered: defaults(
    text(
      "{{store_name}}: your order #{{order_number}} has been delivered. Enjoy!",
      "{{store_name}}: tu pedido n.º {{order_number}} ha sido entregado. ¡Que lo disfrutes!",
      "{{store_name}}: il tuo ordine n. {{order_number}} è stato consegnato. Buon divertimento!",
    ),
  ),
  order_cancelled: defaults(
    text(
      "{{store_name}}: your order #{{order_number}} has been cancelled. Contact us if you have any questions.",
      "{{store_name}}: tu pedido n.º {{order_number}} ha sido cancelado. Escríbenos si tienes alguna duda.",
      "{{store_name}}: il tuo ordine n. {{order_number}} è stato annullato. Contattaci per qualsiasi domanda.",
    ),
  ),
  order_refunded: defaults(
    text(
      "{{store_name}}: we've refunded {{refund_amount}} for your order #{{order_number}}.",
      "{{store_name}}: te hemos reembolsado {{refund_amount}} del pedido n.º {{order_number}}.",
      "{{store_name}}: ti abbiamo rimborsato {{refund_amount}} per l'ordine n. {{order_number}}.",
    ),
  ),
  staff_new_order: defaults(
    text(
      "New order #{{order_number}}: {{order_total}} from {{customer_name}}.\n{{order_link}}",
      "Nuevo pedido n.º {{order_number}}: {{order_total}} de {{customer_name}}.\n{{order_link}}",
      "Nuovo ordine n. {{order_number}}: {{order_total}} da {{customer_name}}.\n{{order_link}}",
    ),
  ),
  staff_low_stock: defaults(
    text(
      "Low stock: {{product_name}} has {{stock_left}} left.",
      "Stock bajo: quedan {{stock_left}} de {{product_name}}.",
      "Scorte basse: restano {{stock_left}} di {{product_name}}.",
    ),
  ),
};

export const DEFAULT_MESSAGING: MessagingSettings = {
  account_sid: "",
  sms_from: "",
  whatsapp_from: "",
  default_country_code: "",
  staff_phones: [],
  events: {},
};

// An event's settings: the owner's edits, or the default.
export function messageEventSettings(settings: MessagingSettings, event: MessageEvent): MessageEventSettings {
  return settings.events[event] ?? DEFAULT_MESSAGE_EVENTS[event];
}

export function isTwilioConfigured(settings: MessagingSettings): boolean {
  return Boolean(settings.account_sid && (settings.sms_from || settings.whatsapp_from));
}

// Whether the checkout asks for consent: at least one customer event is switched on.
export function offersCustomerMessages(settings: MessagingSettings): boolean {
  if (!isTwilioConfigured(settings)) return false;
  return MESSAGE_EVENTS.some((event) => {
    if (STAFF_MESSAGE_EVENTS.includes(event)) return false;
    const config = messageEventSettings(settings, event);
    return (config.sms && Boolean(settings.sms_from)) || (config.whatsapp && Boolean(settings.whatsapp_from));
  });
}

// A typed number as E.164: spaces, dashes, dots and brackets go; 00 becomes +; a number without a
// country code gets `default_country_code` (dropping the national 0, except in Italy, San Marino
// and the Vatican, where it's part of the number). null when it can't be a valid number.
const KEEPS_LEADING_ZERO = new Set(["+39", "+378", "+379"]);
export function toE164(raw: string, default_country_code: string): string | null {
  let value = raw.replace(/[\s().\-/]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!value.startsWith("+")) {
    if (!default_country_code) return null;
    const national = KEEPS_LEADING_ZERO.has(default_country_code) ? value : value.replace(/^0/, "");
    value = `${default_country_code}${national}`;
  }
  return E164.test(value) ? value : null;
}
