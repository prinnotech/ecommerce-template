import { LiveThemeStyle } from "@/components/live-theme-style";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { getDictionary } from "@repo/core/lib/i18n";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// Storefront shell. Nothing here reads cookies, so store pages can be static and revalidated.
export default async function StoreLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);

  return (
    <>
      <LiveThemeStyle />
      <SiteHeader lang={lang} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter lang={lang} />
      <CartDrawer
        lang={lang}
        currency={settings.CURRENCY}
        free_shipping_threshold={settings.FREE_SHIPPING_THRESHOLD}
        dictionary={dictionary.cart}
        errors={dictionary.errors}
        close_label={dictionary.common.close}
        loading_label={dictionary.common.loading}
      />
    </>
  );
}
