import Link from "next/link";

import { getStoreCategories } from "@repo/core/actions/storefront";
import { NewsletterForm } from "@/components/sections/newsletter-form";
import { sectionHref } from "@/components/sections/section-link";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { CookieSettingsButton } from "@/components/tracking/cookie-consent";
import type { Locale } from "@repo/core/i18nConfig";
import { getDictionary } from "@repo/core/lib/i18n";
import { countryName } from "@repo/core/lib/locale/countries";
import { languageOptions } from "@repo/core/lib/locale/language-options";
import { localized } from "@repo/core/lib/localized";
import { enabledPaymentNames } from "@repo/core/lib/payment-methods";
import type { ThemeData } from "@repo/core/lib/schemas/theme";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";
import { colorSchemeClass } from "@repo/core/themes/css";
import { PREVIEW_SECTION_ATTRIBUTE } from "@repo/core/themes/preview";
import { cn } from "@repo/ui/lib/utils";

type SiteFooterProps = {
  lang: string;
  // The theme preview passes the draft's footer; store pages use the live theme.
  footer_group?: ThemeData["footer_group"];
  // The theme editor's preview: the footer can be hovered and selected.
  is_preview?: boolean;
};

export async function SiteFooter({ lang, footer_group, is_preview = false }: SiteFooterProps) {
  const [settings, dictionary, categories, live] = await Promise.all([
    getSiteSettings(),
    getDictionary(lang),
    getStoreCategories(),
    footer_group ? null : getLiveTheme(),
  ]);
  const text = dictionary.store.footer;
  const locale = lang as Locale;
  const theme_footer = (footer_group ?? live?.footer_group)?.footer;
  const newsletter_heading = localized(theme_footer?.newsletter_heading, locale);
  const newsletter_body = localized(theme_footer?.newsletter_body, locale);
  const copyright =
    localized(theme_footer?.copyright, locale) ||
    text.rights.replace("{year}", String(new Date().getFullYear())).replace("{site_name}", settings.SITE_NAME);

  const shop_links = [
    { href: `/${lang}/shop`, label: dictionary.store.header.shop_all },
    ...(categories.ok ? categories.data : [])
      .filter((category) => !category.parent)
      .slice(0, 6)
      .map((category) => ({
        href: `/${lang}/shop?category=${category.slug}`,
        label: localized(category.name, locale),
      })),
  ];
  const help_links = [
    { href: `/${lang}/about`, label: text.about },
    { href: `/${lang}/contact`, label: text.contact },
    { href: `/${lang}/account`, label: text.account },
    { href: `/${lang}/privacy`, label: text.privacy },
    { href: `/${lang}/terms`, label: text.terms },
  ];
  const footer = settings.NAVIGATION.footer;
  // The owner's columns (Navigation tab), or Shop + Help when there are none.
  const columns =
    footer.columns.length > 0
      ? footer.columns.map((column) => ({
          id: column.id,
          title: localized(column.title, locale),
          links: column.links.map((link) => ({
            href: sectionHref(link.href, lang),
            label: localized(link.label, locale),
          })),
        }))
      : [
          { id: "shop", title: text.shop, links: shop_links },
          { id: "help", title: text.help, links: help_links },
        ];
  const about_text = localized(footer.about_text, locale) || localized(settings.SITE_DESCRIPTION, locale);
  const socials =
    theme_footer?.show_socials === false ? [] : Object.entries(settings.SOCIAL_LINKS).filter(([, url]) => url);
  const address = settings.STORE_ADDRESS;
  const address_lines = [
    address.street,
    [address.postal_code, address.city, address.region].filter(Boolean).join(" "),
    address.country ? countryName(address.country, lang) : "",
  ].filter(Boolean);
  const payment_methods = enabledPaymentNames(settings, locale);

  return (
    <footer
      {...(is_preview ? { [PREVIEW_SECTION_ATTRIBUTE]: "group:footer" } : {})}
      className={cn("mt-auto border-t", colorSchemeClass(theme_footer?.color_scheme ?? "muted") || "bg-muted/40")}
    >
      {theme_footer?.show_newsletter && (
        <div className="border-b">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              {newsletter_heading && (
                <h2 className="font-display text-2xl font-medium tracking-tight">{newsletter_heading}</h2>
              )}
              {newsletter_body && <p className="text-muted-foreground text-sm">{newsletter_body}</p>}
            </div>
            <div className="w-full md:max-w-md">
              <NewsletterForm
                id="footer-newsletter"
                lang={lang}
                dictionary={dictionary.newsletter}
                errors={dictionary.errors}
                validation={dictionary.validation}
              />
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:flex lg:gap-12">
        <div className="flex flex-col gap-4 lg:flex-[1.5]">
          <Link href={`/${lang}`} className="font-display w-fit text-2xl font-medium tracking-tight">
            {settings.SITE_NAME}
          </Link>
          {about_text && <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">{about_text}</p>}
          {socials.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{text.follow}</span>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {socials.map(([network, url]) => (
                  <li key={network}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground capitalize"
                    >
                      {network}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {columns.map((column) => (
          <FooterColumn key={column.id} title={column.title} links={column.links} />
        ))}

        {footer.show_contact && (
          <div className="flex flex-col gap-3 lg:flex-1">
            <h2 className="text-sm font-medium">{text.contact_title}</h2>
            <address className="text-muted-foreground flex flex-col gap-1.5 text-sm not-italic">
              {settings.SITE_CONTACT.email && (
                <a href={`mailto:${settings.SITE_CONTACT.email}`} className="hover:text-foreground">
                  {settings.SITE_CONTACT.email}
                </a>
              )}
              {settings.SITE_CONTACT.phone && (
                <a href={`tel:${settings.SITE_CONTACT.phone.replace(/\s+/g, "")}`} className="hover:text-foreground">
                  {settings.SITE_CONTACT.phone}
                </a>
              )}
              {address_lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          </div>
        )}
      </div>

      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright}</p>
          <div className="flex flex-wrap items-center gap-4">
            {footer.show_payments && payment_methods.length > 0 && (
              <span>
                {text.payments}: {payment_methods.join(" · ")}
              </span>
            )}
            <CookieSettingsButton label={text.cookie_settings} />
            <LanguageSwitcher lang={lang} label={text.language} options={languageOptions()} variant="footer" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-1">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((link, index) => (
          <li key={`${index}-${link.href}`}>
            <Link href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
