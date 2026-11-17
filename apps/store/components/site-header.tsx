import { MailIcon, PhoneIcon, SearchIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getStoreCategories } from "@repo/core/actions/storefront";
import { AnnouncementBar, type AnnouncementMessage } from "@/components/storefront/announcement-bar";
import { CartButton } from "@/components/storefront/cart-button";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { MobileMenu, type NavItem } from "@/components/storefront/mobile-menu";
import { sectionHref } from "@/components/sections/section-link";
import { Button } from "@repo/ui/components/ui/button";
import type { Locale } from "@repo/core/i18nConfig";
import { getDictionary } from "@repo/core/lib/i18n";
import { languageOptions } from "@repo/core/lib/locale/language-options";
import { localized } from "@repo/core/lib/localized";
import type { ThemeData } from "@repo/core/lib/schemas/theme";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { colorSchemeClass } from "@repo/core/themes/css";
import { PREVIEW_SECTION_ATTRIBUTE } from "@repo/core/themes/preview";
import { cn } from "@repo/ui/lib/utils";

const MAX_NAV_CATEGORIES = 5;

type SiteHeaderProps = {
  lang: string;
  // The theme preview passes the draft's header; store pages use the live theme.
  header_group?: ThemeData["header_group"];
  // The theme editor's preview: the announcement bar and the header can be hovered and selected.
  is_preview?: boolean;
};

const previewMark = (is_preview: boolean, id: string) => (is_preview ? { [PREVIEW_SECTION_ATTRIBUTE]: id } : {});

// Announcement bar + sticky header in the theme's layout. It never reads the session, so storefront
// pages stay static.
export async function SiteHeader({ lang, header_group, is_preview = false }: SiteHeaderProps) {
  const [settings, dictionary, categories, live] = await Promise.all([
    getSiteSettings(),
    getDictionary(lang),
    getStoreCategories(),
    header_group ? null : getLiveTheme(),
  ]);
  const group = header_group ?? live?.header_group;
  const header = group?.header;
  const announcement_bar = group?.announcement;
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

  // The owner's messages, or the free-shipping line when a threshold is set.
  const custom_messages: AnnouncementMessage[] = (announcement_bar?.messages ?? [])
    .map((message) => ({ text: localized(message.text, locale), href: sectionHref(message.href, lang) }))
    .filter((message) => message.text);
  const free_shipping =
    settings.FREE_SHIPPING_THRESHOLD > 0
      ? dictionary.store.announcement.free_shipping.replace(
          "{amount}",
          formatCurrency(settings.FREE_SHIPPING_THRESHOLD, settings.CURRENCY, lang),
        )
      : "";
  const messages: AnnouncementMessage[] =
    custom_messages.length > 0 ? custom_messages : free_shipping ? [{ text: free_shipping, href: "" }] : [];
  const show_announcement = !announcement_bar?.is_hidden && messages.length > 0;
  const { phone, email } = settings.SITE_CONTACT;
  const languages = (
    <LanguageSwitcher lang={lang} label={dictionary.store.footer.language} options={languageOptions()} />
  );
  const logo = (
    <Link href={`/${lang}`} className="flex items-center">
      <Logo
        name={settings.SITE_NAME}
        logo_url={header?.logo_url || settings.SITE_LOGO_URL}
        width={header?.logo_width ?? 140}
      />
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
      {show_announcement && (
        <div
          {...previewMark(is_preview, "group:announcement")}
          className={colorSchemeClass(announcement_bar?.color_scheme ?? "accent") || "bg-primary text-primary-foreground"}
        >
          <AnnouncementBar
            messages={messages}
            autoplay_seconds={announcement_bar?.autoplay_seconds ?? 5}
            labels={{ previous: text.previous_announcement, next: text.next_announcement }}
          />
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
        {...previewMark(is_preview, "group:header")}
        className={cn(
          "bg-background/90 supports-[backdrop-filter]:bg-background/75 text-foreground z-40 border-b backdrop-blur",
          header?.is_sticky !== false && "sticky top-0",
          colorSchemeClass(header?.color_scheme ?? "default"),
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

function Logo({ name, logo_url, width }: { name: string; logo_url: string; width: number }) {
  if (logo_url) {
    // The logo can live on any host the admin chooses, so skip the image optimizer. The width
    // comes from the theme (computed value); phones get at most 60% of it.
    return (
      <Image
        src={logo_url}
        alt={name}
        width={width}
        height={Math.round(width / 2)}
        unoptimized
        priority
        style={{ width: `min(${width}px, ${Math.round(width * 0.6)}px + 10vw)` }}
        className="h-auto max-h-16 object-contain"
      />
    );
  }
  return <span className="font-display truncate text-xl font-medium tracking-tight sm:text-2xl">{name}</span>;
}
