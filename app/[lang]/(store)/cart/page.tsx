import type { Metadata } from "next";

import { CartView } from "./components/cart-view";
import { trustBadges } from "@/components/storefront/trust-badges";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { getSiteSettings } from "@/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/cart">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/cart", title: dictionary.cart.meta_title, is_private: true });
}

// The cart lives in the browser (localStorage), so this page is a client view priced by the server.
export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);

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
      />
    </div>
  );
}
