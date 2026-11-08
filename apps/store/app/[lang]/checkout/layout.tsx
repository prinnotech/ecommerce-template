import { ShoppingBagIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LiveThemeStyle } from "@/components/live-theme-style";
import { getDictionary } from "@repo/core/lib/i18n";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// Distraction-free checkout shell (no store navigation), like Shopify's.
export default async function CheckoutLayout({ children, params }: LayoutProps<"/[lang]/checkout">) {
  const { lang } = await params;
  const [settings, dictionary] = await Promise.all([getSiteSettings(), getDictionary(lang)]);

  return (
    <div className="flex min-h-svh flex-col">
      <LiveThemeStyle />
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href={`/${lang}`} className="font-display text-xl font-medium tracking-tight sm:text-2xl">
            {settings.SITE_LOGO_URL ? (
              <Image
                src={settings.SITE_LOGO_URL}
                alt={settings.SITE_NAME}
                width={160}
                height={40}
                unoptimized
                className="h-8 w-auto"
              />
            ) : (
              settings.SITE_NAME
            )}
          </Link>
          <Link
            href={`/${lang}/cart`}
            aria-label={dictionary.checkout.return_to_cart}
            className="text-muted-foreground hover:text-foreground"
          >
            <ShoppingBagIcon className="size-5" />
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
