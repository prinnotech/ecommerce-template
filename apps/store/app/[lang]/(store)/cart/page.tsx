import type { Metadata } from "next";

import { CartView } from "./components/cart-view";
import { trustBadges } from "@/components/storefront/trust-badges";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { readCartCookieLines } from "@repo/core/lib/cart-cookie-server";
import { priceLines, type PricedCart } from "@repo/core/lib/checkout/checkout-server";
import { getDictionary } from "@repo/core/lib/i18n";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/cart">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/cart", title: dictionary.cart.meta_title, is_private: true });
}

// The cart is mirrored to a cookie, so the server prices it and renders the items on the
// first paint (audit X8) instead of showing grey placeholders.
export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  const locale: Locale = (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : LOCALES[0];
  const [dictionary, settings, cookie_lines] = await Promise.all([
    getDictionary(lang),
    getSiteSettings(),
    readCartCookieLines(),
  ]);
  const initial_data: PricedCart =
    cookie_lines.length > 0 ? await priceLines(cookie_lines, locale) : { lines: [], removed: [], adjusted: [] };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <CartView
        lang={lang}
        currency={settings.CURRENCY}
        free_shipping_threshold={settings.FREE_SHIPPING_THRESHOLD}
        tax_included={settings.TAX_INCLUDED}
        assurances={trustBadges(settings, dictionary.store.trust, lang).map(({ title, body }) => ({ title, body }))}
        dictionary={dictionary.cart}
        errors={dictionary.errors}
        loading_label={dictionary.common.loading}
        initial_lines={cookie_lines}
        initial_data={initial_data}
      />
    </div>
  );
}
