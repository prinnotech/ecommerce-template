import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, CheckoutSession } from "@repo/core/backend/types";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { findShippingRate } from "@repo/core/lib/checkout/checkout-server";
import { buildOrderEmail } from "@repo/core/lib/email/order-emails";
import { templateSettings } from "@repo/core/lib/email/templates";
import { isSmtpConfigured, sendEmail } from "@repo/core/lib/email/transport";
import { localized } from "@repo/core/lib/localized";
import { ABANDONED_AFTER_MS, AUTOMATIC_WINDOW_MS, RECOVERY_TTL_MS } from "@repo/core/lib/schemas/abandoned-checkouts";
import { reportError } from "@repo/core/lib/server-log";
import { SITE_URL } from "@repo/core/lib/site-config";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export type RecoveryResult = "sent" | "not_found" | "completed" | "no_email" | "failed";

function sessionLocale(session: CheckoutSession, settings: SiteSettings): Locale {
  if (isLocale(session.locale)) return session.locale;
  return isLocale(settings.DEFAULT_LOCALE) ? settings.DEFAULT_LOCALE : LOCALES[0];
}

// The session shaped like an order, so the email uses the same layout (items and totals).
function sessionAsOrder(session: CheckoutSession, settings: SiteSettings): AdminOrderDetail {
  const locale = sessionLocale(session, settings);
  const rate = findShippingRate(settings, session.shipping_method);
  return {
    id: session.id,
    order_number: 0,
    created_at: new Date().toISOString(),
    status: "pending",
    payment_status: "unpaid",
    payment_method: "",
    email: session.email,
    phone: session.shipping_address?.phone ?? "",
    locale,
    shipping_address: session.shipping_address,
    billing_address: null,
    shipping_method: rate ? localized(rate.name, locale) || rate.id : "",
    customer_note: "",
    internal_note: "",
    attribution: null,
    refunded_total: 0,
    refunds: [],
    gift_card_total: 0,
    checkout_session_id: "",
    tracking_number: "",
    carrier: "",
    tracking_url: "",
    paid_at: "",
    shipped_at: "",
    delivered_at: "",
    cancelled_at: "",
    items: session.line_items.map((line, index) => ({
      id: String(index),
      product: line.product_id,
      variant: line.variant_id,
      title: line.title,
      variant_label: line.variant_label,
      sku: line.sku,
      image: line.image,
      unit_price: line.unit_price,
      quantity: line.quantity,
      line_total: line.line_total,
    })),
    events: [],
    payments: [],
    customer: null,
    discount_code: "",
    currency: session.currency || settings.CURRENCY,
    subtotal: session.subtotal,
    discount_total: session.discount_total,
    shipping_total: session.shipping_total,
    tax_total: session.tax_total,
    cod_fee: session.cod_fee,
    total: session.total,
  };
}

// Reopens the checkout for a week and emails the customer a link back to it.
export async function sendRecoveryEmail(session_id: string, settings?: SiteSettings): Promise<RecoveryResult> {
  const store = settings ?? (await getSiteSettings());
  const backend = getBackend();
  const session = await backend.checkout.getSession(session_id);
  if (!session) return "not_found";
  if (session.status === "completed") return "completed";
  if (!session.email) return "no_email";

  const locale = sessionLocale(session, store);
  const checkout_link = `${SITE_URL}/${locale}/checkout/${session.id}`;
  const email = await buildOrderEmail("abandoned_checkout", sessionAsOrder(session, store), {
    ignore_disabled: true,
    extra: { checkout_link, customer_name: session.shipping_address?.full_name ?? "" },
  });
  if (!email) return "no_email";
  // Reopen first: the link must work the moment the email lands.
  await backend.abandoned_checkouts.markRecoverySent(session.id, new Date(Date.now() + RECOVERY_TTL_MS).toISOString());
  const result = await sendEmail({ ...email, template: "abandoned_checkout", order_id: "" });
  return result.ok ? "sent" : "failed";
}

// The cron job: one email per abandoned checkout, `abandoned_delay_hours` after the email was typed.
export async function sendDueRecoveryEmails(limit = 50): Promise<{ sent: number; failed: number }> {
  const settings = await getSiteSettings();
  const hours = settings.NOTIFICATIONS.abandoned_delay_hours;
  const is_on = hours > 0 && templateSettings(settings.NOTIFICATIONS, "abandoned_checkout").is_enabled;
  if (!is_on || !isSmtpConfigured(settings.SMTP)) return { sent: 0, failed: 0 };

  const now = Date.now();
  const before = new Date(now - Math.max(hours * 60 * 60 * 1000, ABANDONED_AFTER_MS)).toISOString();
  const after = new Date(now - AUTOMATIC_WINDOW_MS).toISOString();
  const ids = await getBackend().abandoned_checkouts.due(before, after, limit);
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      if ((await sendRecoveryEmail(id, settings)) === "sent") sent++;
      else failed++;
    } catch (error) {
      failed++;
      await reportError("abandoned-checkouts", `recovery ${id}`, error);
    }
  }
  return { sent, failed };
}
