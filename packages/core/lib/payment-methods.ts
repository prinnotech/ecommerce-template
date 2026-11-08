import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { SiteSettings } from "@repo/core/lib/site-settings";

// What the storefront says about payment methods (footer, trust badges, order pages).

export function hasCashOnDelivery(settings: SiteSettings): boolean {
  return settings.PAYMENT_METHODS.some((method) => method.is_enabled && method.type === "cash_on_delivery");
}

export function enabledPaymentNames(settings: SiteSettings, locale: Locale): string[] {
  return settings.PAYMENT_METHODS.filter((method) => method.is_enabled).map(
    (method) => localized(method.name, locale) || method.id,
  );
}

// An order's method by its id. Orders from before the methods list may say "card".
export function paymentMethodName(
  settings: SiteSettings,
  id: string,
  locale: Locale,
  fallback: { card: string; cash_on_delivery: string; manual: string },
): string {
  const method = settings.PAYMENT_METHODS.find((item) => item.id === id);
  if (method) return localized(method.name, locale) || method.id;
  if (id === "card" || id === "stripe") return fallback.card;
  if (id === "cash_on_delivery") return fallback.cash_on_delivery;
  // Orders created by staff from a draft.
  if (id === "manual") return fallback.manual;
  return id;
}
