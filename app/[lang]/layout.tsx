import "@/app/globals.css";

import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";

import { Toaster } from "@/components/ui/sonner";
import { LOCALES } from "@/i18nConfig";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getSiteSetting } from "@/lib/site-settings-server";
import { CartHydrator } from "@/providers/cart-hydrator";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

const geist_sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geist_mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display serif for storefront headings (font-display): gives the store its boutique feel.
const fraunces = Fraunces({ variable: "--font-serif", subsets: ["latin"] });

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

  const [dictionary, is_maintenance] = await Promise.all([getDictionary(lang), getSiteSetting("MAINTENANCE_MODE")]);

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${geist_sans.variable} ${geist_mono.variable} ${fraunces.variable} h-full antialiased`}
    >
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
            <Toaster richColors position="top-center" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
