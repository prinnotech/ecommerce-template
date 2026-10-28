import { SearchIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getStoreCategories } from "@/app/actions/storefront";
import { CartButton } from "@/components/storefront/cart-button";
import { MobileMenu } from "@/components/storefront/mobile-menu";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18nConfig";
import { getDictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { getSiteSettings } from "@/lib/site-settings-server";
import { formatCurrency } from "@/lib/utils/format";

const MAX_NAV_CATEGORIES = 5;

// Announcement bar + sticky header. It never reads the session, so storefront pages stay static.
export async function SiteHeader({ lang }: { lang: string }) {
  const [settings, dictionary, categories] = await Promise.all([
    getSiteSettings(),
    getDictionary(lang),
    getStoreCategories(),
  ]);
  const text = dictionary.store.header;
  const locale = lang as Locale;

  const top_categories = (categories.ok ? categories.data : []).filter((category) => !category.parent);
  const nav_links = [
    { href: `/${lang}/shop`, label: text.shop_all },
    ...top_categories.slice(0, MAX_NAV_CATEGORIES).map((category) => ({
      href: `/${lang}/shop?category=${category.slug}`,
      label: localized(category.name, locale),
    })),
  ];

  const custom_announcement = localized(settings.ANNOUNCEMENT, locale);
  const announcement =
    custom_announcement ||
    (settings.FREE_SHIPPING_THRESHOLD > 0
      ? dictionary.store.announcement.free_shipping.replace(
          "{amount}",
          formatCurrency(settings.FREE_SHIPPING_THRESHOLD, settings.CURRENCY, lang),
        )
      : "");

  return (
    <>
      {announcement && (
        <div className="bg-primary text-primary-foreground px-4 py-2 text-center text-xs font-medium tracking-wide sm:text-sm">
          {announcement}
        </div>
      )}
      <header className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 lg:flex lg:justify-between">
          <div className="flex items-center gap-1 lg:gap-10">
            <MobileMenu
              site_name={settings.SITE_NAME}
              links={nav_links}
              secondary_links={[{ href: `/${lang}/account`, label: text.account }]}
              labels={{ open: text.menu, title: text.menu_title, close: dictionary.common.close }}
            />
            <Link href={`/${lang}`} className="hidden items-center lg:flex">
              <Logo name={settings.SITE_NAME} logo_url={settings.SITE_LOGO_URL} />
            </Link>
            <nav aria-label={text.nav_label} className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {nav_links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Centered logo on small screens, like most fashion stores. */}
          <Link href={`/${lang}`} className="flex items-center justify-center lg:hidden">
            <Logo name={settings.SITE_NAME} logo_url={settings.SITE_LOGO_URL} />
          </Link>

          <div className="flex items-center justify-end gap-0.5">
            <Button asChild variant="ghost" size="icon" aria-label={text.search}>
              <Link href={`/${lang}/shop`}>
                <SearchIcon />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label={text.account} className="hidden sm:inline-flex">
              <Link href={`/${lang}/account`}>
                <UserIcon />
              </Link>
            </Button>
            <CartButton lang={lang} label={text.cart} count_label={text.cart_count} />
          </div>
        </div>
      </header>
    </>
  );
}

function Logo({ name, logo_url }: { name: string; logo_url: string }) {
  if (logo_url) {
    // The logo can live on any host the admin chooses, so skip the image optimizer.
    return <Image src={logo_url} alt={name} width={160} height={40} unoptimized priority className="h-8 w-auto" />;
  }
  return <span className="font-display truncate text-xl font-medium tracking-tight sm:text-2xl">{name}</span>;
}
