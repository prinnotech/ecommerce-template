import "server-only";

import { after } from "next/server";

import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail } from "@repo/core/backend/types";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { renderEmail, type EmailSummary } from "@repo/core/lib/email/layout";
import {
  fillPlaceholders,
  STAFF_TEMPLATES,
  templateSettings,
  type EmailTemplate,
  type Placeholder,
  type TemplateSettings,
} from "@repo/core/lib/email/templates";
import { sendEmail } from "@repo/core/lib/email/transport";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { reportError } from "@repo/core/lib/server-log";
import { ADMIN_URL, SITE_URL } from "@repo/core/lib/site-config";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";
import { formatCurrency } from "@repo/core/lib/utils/format";

// Order emails (Settings → Notifications): built from the order, the template in the order's
// language and the store's look, and sent after the response, so a slow mail server never slows
// down the checkout or an admin action.

export type BuiltEmail = { to: string; subject: string; html: string; text: string };

function orderLocale(order: AdminOrderDetail, settings: SiteSettings): Locale {
  return isLocale(order.locale)
    ? order.locale
    : isLocale(settings.DEFAULT_LOCALE)
      ? settings.DEFAULT_LOCALE
      : LOCALES[0];
}

function placeholderValues(
  order: AdminOrderDetail,
  settings: SiteSettings,
  locale: Locale,
  extra: Partial<Record<Placeholder, string>>,
  is_staff: boolean,
): Partial<Record<Placeholder, string>> {
  const method = settings.PAYMENT_METHODS.find((item) => item.id === order.payment_method);
  const money = (cents: number) => formatCurrency(cents, order.currency || settings.CURRENCY, locale);
  const customer_name = order.customer?.name || order.shipping_address?.full_name || order.email;
  // Customers follow the order in their account; guests have no page to open.
  const order_link = is_staff
    ? `${ADMIN_URL}/orders/${order.id}`
    : order.customer
      ? `${SITE_URL}/${locale}/account/orders/${order.id}`
      : "";
  return {
    store_name: settings.SITE_NAME,
    customer_name,
    order_number: String(order.order_number),
    order_total: money(order.total),
    order_link,
    payment_method: method ? localized(method.name, locale) || method.id : order.payment_method,
    // Instructions only matter while the order still waits for the money.
    payment_instructions: method && order.payment_status === "unpaid" ? localized(method.instructions, locale) : "",
    shipping_method: order.shipping_method,
    tracking_number: order.tracking_number,
    tracking_link: order.tracking_url,
    carrier: order.carrier,
    refund_amount: money(order.refunds[0]?.amount ?? order.total),
    ...extra,
  };
}

async function orderSummary(order: AdminOrderDetail, settings: SiteSettings, locale: Locale): Promise<EmailSummary> {
  const text = (await getDictionary(locale)).checkout;
  const money = (cents: number) => formatCurrency(cents, order.currency || settings.CURRENCY, locale);
  const rows = [
    { label: text.subtotal, value: money(order.subtotal), is_shown: true },
    { label: text.discount, value: `−${money(order.discount_total)}`, is_shown: order.discount_total > 0 },
    { label: text.shipping, value: order.shipping_total > 0 ? money(order.shipping_total) : text.free, is_shown: true },
    { label: text.cod_fee_label, value: money(order.cod_fee), is_shown: order.cod_fee > 0 },
    { label: text.taxes, value: money(order.tax_total), is_shown: !settings.TAX_INCLUDED && order.tax_total > 0 },
    // With a gift card the last line is what is still to pay, so the order total moves up here.
    { label: text.total, value: money(order.total), is_shown: order.gift_card_total > 0 },
    { label: text.gift_card, value: `−${money(order.gift_card_total)}`, is_shown: order.gift_card_total > 0 },
  ];
  return {
    lines: order.items.map((item) => ({
      title: item.title,
      detail: item.variant_label,
      quantity: item.quantity,
      amount: money(item.line_total),
    })),
    rows: rows.filter((row) => row.is_shown).map(({ label, value }) => ({ label, value })),
    total:
      order.gift_card_total > 0
        ? { label: text.to_pay, value: money(Math.max(0, order.total - order.gift_card_total)) }
        : { label: text.total, value: money(order.total) },
  };
}

// One email for one order, or null when it's switched off or has no recipient.
export async function buildOrderEmail(
  template: EmailTemplate,
  order: AdminOrderDetail,
  options: {
    to?: string;
    extra?: Partial<Record<Placeholder, string>>;
    // The editor's preview and test: unsaved text, in a chosen language, even if switched off.
    config?: TemplateSettings;
    locale?: Locale;
    ignore_disabled?: boolean;
  } = {},
): Promise<BuiltEmail | null> {
  const [settings, theme] = await Promise.all([getSiteSettings(), getLiveTheme()]);
  const config = options.config ?? templateSettings(settings.NOTIFICATIONS, template);
  if (!config.is_enabled && !options.ignore_disabled) return null;
  const is_staff = STAFF_TEMPLATES.includes(template);
  const locale =
    options.locale ?? (is_staff ? orderLocale({ ...order, locale: "" }, settings) : orderLocale(order, settings));
  const to = options.to ?? (is_staff ? settings.NOTIFICATIONS.staff_recipients.join(", ") : order.email);
  if (!to) return null;

  const values = placeholderValues(order, settings, locale, options.extra ?? {}, is_staff);
  const subject = fillPlaceholders(localized(config.subject, locale), values).replace(/\s+/g, " ");
  const body = fillPlaceholders(localized(config.body, locale), values);
  const { email, phone } = settings.SITE_CONTACT;
  const { html, text } = renderEmail({
    store_name: settings.SITE_NAME,
    logo_url: settings.SITE_LOGO_URL,
    accent_color: theme.settings.colors.light.primary,
    contact_line: [email, phone].filter(Boolean).join(" · "),
    subject,
    body,
    // A gift card email has no order to sum up.
    summary: template === "gift_card" ? undefined : await orderSummary(order, settings, locale),
  });
  return { to, subject, html, text };
}

async function sendForOrder(
  template: EmailTemplate,
  order: AdminOrderDetail,
  extra?: Partial<Record<Placeholder, string>>,
) {
  const email = await buildOrderEmail(template, order, { extra });
  if (email) await sendEmail({ ...email, template, order_id: order.id });
}

// Schedules the email(s) for an order event. A new order also tells the staff.
export async function sendOrderEmails(
  template: EmailTemplate,
  order_ref: number | { id: string },
  extra?: Partial<Record<Placeholder, string>>,
): Promise<void> {
  after(async () => {
    try {
      const orders = getBackend().orders;
      const id = typeof order_ref === "number" ? await orders.getIdByNumber(order_ref) : order_ref.id;
      if (!id) return;
      const order = await orders.get(id);
      await sendForOrder(template, order, extra);
      if (template === "order_confirmation") await sendForOrder("staff_new_order", order);
    } catch (error) {
      await reportError("email", `order emails (${template})`, error);
    }
  });
}
