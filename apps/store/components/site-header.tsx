import { MailIcon, PhoneIcon, SearchIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getStoreCategories } from "@repo/core/actions/storefront";
import { CartButton } from "@/components/storefront/cart-button";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { MobileMenu, type NavItem } from "@/components/storefront/mobile-menu";
import { sectionHref } from "@/components/sections/section-link";
import { Button } from "@repo/ui/components/ui/button";
import type { Locale } from "@repo/core/i18nConfig";
import { getDictionary } from "@repo/core/lib/i18n";
import { languageOptions } from "@repo/core/lib/locale/language-options";
import { localized } from "@repo/core/lib/localized";
import type { ThemeSettings } from "@repo/core/lib/schemas/theme";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { cn } from "@repo/ui/lib/utils";

const MAX_NAV_CATEGORIES = 5;

type SiteHeaderProps = {
  lang: string;
  // The theme preview passes the draft's settings; store pages use the live theme.
  theme?: ThemeSettings;
};

// Announcement bar + sticky header in the theme's layout. It never reads the session, so storefront
// pages stay static.
export async function SiteHeader({ lang, theme }: SiteHeaderProps) {
  const [settings, dictionary, categories, live] = await Promise.all([
    getSiteSettings(),
    getDictionary(lang),
    getStoreCategories(),
    theme ? null : getLiveTheme(),
  ]);
  const { header } = theme ?? live?.settings ?? { header: undefined };
  const layout = header?.layout ?? "inline";
  const text = dictionary.store.header;
  const locale = lang as Locale;

  const top_categories = (categories.ok ? categories.data : []).filter((category) => !category.parent);
  // The owner's menu (Navigation tab), or "Shop all" + the top categories when there's none.
  const menu = settings.NAVIGATION.header;
  const nav_links: NavItem[] =
    menu.length > 0
      ? menu.map((item) => ({
          href: sectionHref(item.href, lang),
          label: localized(item.label, locale),
          children: item.children.map((child) => ({
            href: sectionHref(child.href, lang),
            label: localized(child.label, locale),
          })),
        }))
      : [
          { href: `/${lang}/shop`, label: text.shop_all },
          ...top_categories.slice(0, MAX_NAV_CATEGORIES).map((category) => ({
            href: `/${lang}/shop?category=${category.slug}`,
            label: localized(category.name, locale),
          })),
        ];

  const custom_announcement = localized(header?.announcement, locale);
  const announcement =
    custom_announcement ||
    (settings.FREE_SHIPPING_THRESHOLD > 0
      ? dictionary.store.announcement.free_shipping.replace(
          "{amount}",
          formatCurrency(settings.FREE_SHIPPING_THRESHOLD, settings.CURRENCY, lang),
        )
      : "");
  const { phone, email } = settings.SITE_CONTACT;
  const languages = (
    <LanguageSwitcher lang={lang} label={dictionary.store.footer.language} options={languageOptions()} />
  );
  const logo = (
    <Link href={`/${lang}`} className="flex items-center">
      <Logo name={settings.SITE_NAME} logo_url={settings.SITE_LOGO_URL} />
    </Link>
  );
  const nav = (
    <nav aria-label={text.nav_label} className="hidden lg:block">
      <ul className={cn("flex items-center gap-7", layout === "centered" && "justify-center")}>
        {nav_links.map((link, index) => (
          <li key={`${index}-${link.href}`} className="group relative">
            <Link
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
            {link.children && link.children.length > 0 && (
              // Opens on hover and on keyboard focus (focus-within), no JavaScript needed.
              <ul className="bg-popover text-popover-foreground invisible absolute top-full left-1/2 z-50 mt-2 min-w-48 -translate-x-1/2 rounded-md border p-1.5 opacity-0 shadow-md transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 before:absolute before:inset-x-0 before:-top-2 before:h-2">
                {link.children.map((child, child_index) => (
                  <li key={`${child_index}-${child.href}`}>
                    <Link
                      href={child.href}
                      className="hover:bg-muted block rounded px-3 py-2 text-sm whitespace-nowrap"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
  const mobile_menu = (
    <MobileMenu
      site_name={settings.SITE_NAME}
      links={nav_links}
      secondary_links={[{ href: `/${lang}/account`, label: text.account }]}
      labels={{ open: text.menu, title: text.menu_title, close: dictionary.common.close }}
    />
  );
  const icons = (
    <div className="flex items-center justify-end gap-0.5">
      {/* The utility bar already has the language switcher. */}
      {!header?.show_utility_bar && <div className="hidden sm:block">{languages}</div>}
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
  );

  return (
    <>
      {announcement && (
        <div className="bg-primary text-primary-foreground px-4 py-2 text-center text-xs font-medium tracking-wide sm:text-sm">
          {announcement}
        </div>
      )}
      {header?.show_utility_bar && (
        <div className="bg-muted text-muted-foreground hidden border-b text-xs sm:block">
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-5">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="hover:text-foreground flex items-center gap-1.5"
                >
                  <PhoneIcon className="size-3.5" aria-hidden />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="hover:text-foreground flex items-center gap-1.5">
                  <MailIcon className="size-3.5" aria-hidden />
                  {email}
                </a>
              )}
            </div>
            {languages}
          </div>
        </div>
      )}
      <header
        className={cn(
          "bg-background/90 supports-[backdrop-filter]:bg-background/75 text-foreground sticky top-0 z-40 border-b backdrop-blur",
          layout === "inverted" && "theme-inverted bg-background supports-[backdrop-filter]:bg-background",
        )}
      >
        {layout === "centered" ? (
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="flex items-center">{mobile_menu}</div>
              {logo}
              {icons}
            </div>
            <div className="hidden pb-3 lg:block">{nav}</div>
          </div>
        ) : (
          <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 lg:flex lg:justify-between">
            <div className="flex items-center gap-1 lg:gap-10">
              {mobile_menu}
              <div className="hidden lg:flex">{logo}</div>
              {nav}
            </div>
            {/* Centered logo on small screens, like most fashion stores. */}
            <div className="flex justify-center lg:hidden">{logo}</div>
            {icons}
          </div>
        )}
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
