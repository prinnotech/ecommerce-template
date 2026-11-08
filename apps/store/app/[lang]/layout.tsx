import "@/app/globals.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CookieConsent } from "@/components/tracking/cookie-consent";
import { TrackingScripts } from "@/components/tracking/tracking-scripts";
import { THEME_FONT_CLASSES } from "@/lib/theme-fonts";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { LOCALES } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary, isLocale } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { CartHydrator } from "@repo/core/providers/cart-hydrator";
import { WishlistSync } from "@repo/core/providers/wishlist-sync";
import { QueryProvider } from "@repo/core/providers/query-provider";
import { ThemeProvider } from "@repo/core/providers/theme-provider";

// Static pages pick up site setting changes within a minute even without on-demand revalidation.
export const revalidate = 60;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return buildPageMetadata({ lang, path: "" });
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dictionary, is_maintenance, tracking] = await Promise.all([
    getDictionary(lang),
    getSiteSetting("MAINTENANCE_MODE"),
    getSiteSetting("TRACKING"),
  ]);

  return (
    <html lang={lang} suppressHydrationWarning className={`${THEME_FONT_CLASSES} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {is_maintenance && (
              <div role="status" className="bg-primary text-primary-foreground px-4 py-2 text-center text-sm">
                {dictionary.maintenance.notice}
              </div>
            )}
            {children}
            <CartHydrator />
            <WishlistSync />
            <TrackingScripts tracking={tracking} />
            <CookieConsent lang={lang} dictionary={dictionary.cookie_consent} />
            <Toaster richColors position="top-center" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
