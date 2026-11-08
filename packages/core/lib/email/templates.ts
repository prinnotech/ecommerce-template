import { z } from "zod";

import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";

// The store's emails (Settings → Notifications). Each one has an on/off switch, a subject and a
// body per language. Placeholders like {{order_number}} are filled when it's sent; order emails
// get the items and totals added under the body automatically.

export const EMAIL_TEMPLATES = [
  "order_confirmation",
  "payment_received",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "order_refunded",
  "draft_invoice",
  "abandoned_checkout",
  "gift_card",
  "staff_new_order",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

// Who receives it: the customer, or the staff addresses in Settings → Notifications.
export const STAFF_TEMPLATES: readonly EmailTemplate[] = ["staff_new_order"];

export const PLACEHOLDERS = [
  "store_name",
  "customer_name",
  "order_number",
  "order_total",
  "order_link",
  "payment_method",
  "payment_instructions",
  "shipping_method",
  "tracking_number",
  "tracking_link",
  "carrier",
  "invoice_link",
  "checkout_link",
  "refund_amount",
  "gift_card_code",
  "gift_card_balance",
  "gift_card_expires",
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export const template_settings_schema = z.object({
  is_enabled: z.boolean(),
  subject: localized_text_schema,
  body: localized_text_schema,
});
export type TemplateSettings = z.infer<typeof template_settings_schema>;

const text = (en: string, es: string, it: string): LocalizedText => ({ en, es, it });

export const DEFAULT_TEMPLATES: Record<EmailTemplate, TemplateSettings> = {
  order_confirmation: {
    is_enabled: true,
    subject: text(
      "Order #{{order_number}} confirmed",
      "Pedido n.º {{order_number}} confirmado",
      "Ordine n. {{order_number}} confermato",
    ),
    body: text(
      "Hi {{customer_name}},\n\nThank you for your order! We're getting it ready.\n\nPayment: {{payment_method}}\n{{payment_instructions}}\n\nYou can follow your order here: {{order_link}}",
      "Hola {{customer_name}}:\n\n¡Gracias por tu pedido! Ya lo estamos preparando.\n\nPago: {{payment_method}}\n{{payment_instructions}}\n\nPuedes seguir tu pedido aquí: {{order_link}}",
      "Ciao {{customer_name}},\n\ngrazie per il tuo ordine! Lo stiamo preparando.\n\nPagamento: {{payment_method}}\n{{payment_instructions}}\n\nPuoi seguire l'ordine qui: {{order_link}}",
    ),
  },
  payment_received: {
    is_enabled: true,
    subject: text(
      "Payment received for order #{{order_number}}",
      "Pago recibido del pedido n.º {{order_number}}",
      "Pagamento ricevuto per l'ordine n. {{order_number}}",
    ),
    body: text(
      "Hi {{customer_name}},\n\nWe've received your payment of {{order_total}}. Your order will ship soon.",
      "Hola {{customer_name}}:\n\nHemos recibido tu pago de {{order_total}}. Tu pedido saldrá pronto.",
      "Ciao {{customer_name}},\n\nabbiamo ricevuto il tuo pagamento di {{order_total}}. Il tuo ordine partirà presto.",
    ),
  },
  order_shipped: {
    is_enabled: true,
    subject: text(
      "Your order #{{order_number}} is on its way",
      "Tu pedido n.º {{order_number}} está en camino",
      "Il tuo ordine n. {{order_number}} è in viaggio",
    ),
    body: text(
      "Hi {{customer_name}},\n\nGood news: your order has shipped with {{carrier}}.\nTracking number: {{tracking_number}}\nTrack it here: {{tracking_link}}",
      "Hola {{customer_name}}:\n\nBuenas noticias: tu pedido ha salido con {{carrier}}.\nNúmero de seguimiento: {{tracking_number}}\nSíguelo aquí: {{tracking_link}}",
      "Ciao {{customer_name}},\n\nbuone notizie: il tuo ordine è stato spedito con {{carrier}}.\nNumero di tracciamento: {{tracking_number}}\nSeguilo qui: {{tracking_link}}",
    ),
  },
  order_delivered: {
    is_enabled: true,
    subject: text(
      "Order #{{order_number}} delivered",
      "Pedido n.º {{order_number}} entregado",
      "Ordine n. {{order_number}} consegnato",
    ),
    body: text(
      "Hi {{customer_name}},\n\nYour order has been delivered. We hope you love it!",
      "Hola {{customer_name}}:\n\nTu pedido ha sido entregado. ¡Esperamos que te encante!",
      "Ciao {{customer_name}},\n\nil tuo ordine è stato consegnato. Speriamo che ti piaccia!",
    ),
  },
  order_cancelled: {
    is_enabled: true,
    subject: text(
      "Order #{{order_number}} cancelled",
      "Pedido n.º {{order_number}} cancelado",
      "Ordine n. {{order_number}} annullato",
    ),
    body: text(
      "Hi {{customer_name}},\n\nYour order has been cancelled. If you have any questions, just reply to this email.",
      "Hola {{customer_name}}:\n\nTu pedido ha sido cancelado. Si tienes alguna pregunta, responde a este email.",
      "Ciao {{customer_name}},\n\nil tuo ordine è stato annullato. Per qualsiasi domanda, rispondi a questa email.",
    ),
  },
  order_refunded: {
    is_enabled: true,
    subject: text(
      "Refund for order #{{order_number}}",
      "Reembolso del pedido n.º {{order_number}}",
      "Rimborso per l'ordine n. {{order_number}}",
    ),
    body: text(
      "Hi {{customer_name}},\n\nWe've refunded {{refund_amount}}. Depending on your bank it can take a few days to appear.",
      "Hola {{customer_name}}:\n\nTe hemos reembolsado {{refund_amount}}. Según tu banco, puede tardar unos días en aparecer.",
      "Ciao {{customer_name}},\n\nti abbiamo rimborsato {{refund_amount}}. A seconda della banca, può richiedere qualche giorno.",
    ),
  },
  draft_invoice: {
    is_enabled: true,
    subject: text("Your order from {{store_name}}", "Tu pedido de {{store_name}}", "Il tuo ordine da {{store_name}}"),
    body: text(
      "Hi {{customer_name}},\n\nWe've prepared your order. Complete it and pay here: {{invoice_link}}",
      "Hola {{customer_name}}:\n\nHemos preparado tu pedido. Complétalo y paga aquí: {{invoice_link}}",
      "Ciao {{customer_name}},\n\nabbiamo preparato il tuo ordine. Completalo e paga qui: {{invoice_link}}",
    ),
  },
  abandoned_checkout: {
    is_enabled: true,
    subject: text(
      "You left something in your cart",
      "Te has dejado algo en el carrito",
      "Hai lasciato qualcosa nel carrello",
    ),
    body: text(
      "Hi {{customer_name}},\n\nYou didn't finish your order at {{store_name}}. Your items are still waiting: {{checkout_link}}",
      "Hola {{customer_name}}:\n\nNo terminaste tu pedido en {{store_name}}. Tus artículos te siguen esperando: {{checkout_link}}",
      "Ciao {{customer_name}},\n\nnon hai completato il tuo ordine su {{store_name}}. I tuoi articoli ti aspettano ancora: {{checkout_link}}",
    ),
  },
  gift_card: {
    is_enabled: true,
    subject: text(
      "Your {{store_name}} gift card",
      "Tu tarjeta regalo de {{store_name}}",
      "La tua carta regalo {{store_name}}",
    ),
    body: text(
      "Hi {{customer_name}},\n\nHere is your gift card for {{gift_card_balance}}.\n\nCode: {{gift_card_code}}\nValid until: {{gift_card_expires}}\n\nEnter the code at checkout (in the discount code field).",
      "Hola {{customer_name}}:\n\nAquí tienes tu tarjeta regalo de {{gift_card_balance}}.\n\nCódigo: {{gift_card_code}}\nVálida hasta: {{gift_card_expires}}\n\nEscribe el código al pagar (en el campo del código de descuento).",
      "Ciao {{customer_name}},\n\necco la tua carta regalo da {{gift_card_balance}}.\n\nCodice: {{gift_card_code}}\nValida fino al: {{gift_card_expires}}\n\nInserisci il codice al pagamento (nel campo del codice sconto).",
    ),
  },
  staff_new_order: {
    is_enabled: true,
    subject: text(
      "New order #{{order_number}} ({{order_total}})",
      "Nuevo pedido n.º {{order_number}} ({{order_total}})",
      "Nuovo ordine n. {{order_number}} ({{order_total}})",
    ),
    body: text(
      "{{customer_name}} placed an order of {{order_total}}.\nPayment: {{payment_method}}\nShipping: {{shipping_method}}\n\nOpen it in the admin: {{order_link}}",
      "{{customer_name}} ha hecho un pedido de {{order_total}}.\nPago: {{payment_method}}\nEnvío: {{shipping_method}}\n\nÁbrelo en el admin: {{order_link}}",
      "{{customer_name}} ha effettuato un ordine di {{order_total}}.\nPagamento: {{payment_method}}\nSpedizione: {{shipping_method}}\n\nAprilo nell'admin: {{order_link}}",
    ),
  },
};

export const notifications_schema = z.object({
  // Staff addresses for staff_new_order.
  staff_recipients: z.array(z.email()).max(10),
  templates: z.partialRecord(z.enum(EMAIL_TEMPLATES), template_settings_schema),
  // Hours after the email is typed before the abandoned-checkout email goes out on its own
  // (0 = only by hand, from Orders → Abandoned checkouts). Needs the cron job (docs/deploy.md).
  abandoned_delay_hours: z.number().int().min(0).max(72).catch(0),
});
export type NotificationSettings = z.infer<typeof notifications_schema>;

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  staff_recipients: [],
  templates: {},
  abandoned_delay_hours: 0,
};

// A template's settings: the owner's edits, or the default.
export function templateSettings(settings: NotificationSettings, template: EmailTemplate): TemplateSettings {
  return settings.templates[template] ?? DEFAULT_TEMPLATES[template];
}

// {{name}} → value. A line with a placeholder that has no value is left out, so
// "Tracking number: {{tracking_number}}" disappears when there's none. Text is plain (the email
// layout escapes it), so a value can never inject HTML.
export function fillPlaceholders(template: string, values: Partial<Record<Placeholder, string>>): string {
  return template
    .split("\n")
    .flatMap((line) => {
      let is_missing = false;
      const filled = line.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, name: string) => {
        const value = values[name as Placeholder] ?? "";
        if (!value) is_missing = true;
        return value;
      });
      return is_missing ? [] : [filled];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const SMTP_SECURITY = ["starttls", "tls", "none"] as const;

export const smtp_schema = z.object({
  host: z.string().trim().max(200),
  port: z.number().int().min(1).max(65535),
  // starttls = port 587, tls = port 465, none = local testing servers only.
  security: z.enum(SMTP_SECURITY),
  username: z.string().trim().max(200),
  from_name: z.string().trim().max(100),
  from_email: z.union([z.email(), z.literal("")]),
});
export type SmtpSettings = z.infer<typeof smtp_schema>;

export const DEFAULT_SMTP: SmtpSettings = {
  host: "",
  port: 587,
  security: "starttls",
  username: "",
  from_name: "",
  from_email: "",
};
