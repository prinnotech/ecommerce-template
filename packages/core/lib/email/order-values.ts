import "server-only";

import type { AdminOrderDetail } from "@repo/core/backend/types";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import type { Placeholder } from "@repo/core/lib/email/templates";
import { localized } from "@repo/core/lib/localized";
import { ADMIN_URL, SITE_URL } from "@repo/core/lib/site-config";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { formatCurrency } from "@repo/core/lib/utils/format";

// What an order's {{placeholders}} become, shared by the order emails and the SMS/WhatsApp messages.

export function orderLocale(order: AdminOrderDetail, settings: SiteSettings): Locale {
  return isLocale(order.locale)
    ? order.locale
    : isLocale(settings.DEFAULT_LOCALE)
      ? settings.DEFAULT_LOCALE
      : LOCALES[0];
}

export function placeholderValues(
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
