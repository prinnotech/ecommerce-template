import Link from "next/link";
import { Suspense } from "react";

import { getStoreCategories } from "@/app/actions/storefront";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { LOCALES, type Locale } from "@/i18nConfig";
import { getDictionary } from "@/lib/i18n";
import { countryName } from "@/lib/locale/countries";
import { localized } from "@/lib/localized";
import { getSiteSettings } from "@/lib/site-settings-server";

export async function SiteFooter({ lang }: { lang: string }) {
  const [settings, dictionary, categories] = await Promise.all([
    getSiteSettings(),
    getDictionary(lang),
    getStoreCategories(),
  ]);
  const text = dictionary.store.footer;
  const locale = lang as Locale;
  const language_names = new Intl.DisplayNames([lang], { type: "language" });

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
  const socials = Object.entries(settings.SOCIAL_LINKS).filter(([, url]) => url);
  const address = settings.STORE_ADDRESS;
  const address_lines = [
    address.street,
    [address.postal_code, address.city, address.region].filter(Boolean).join(" "),
    address.country ? countryName(address.country, lang) : "",
  ].filter(Boolean);
  const payment_methods = [
    settings.PAYMENT_METHODS.card ? dictionary.payment_method.card : "",
    settings.PAYMENT_METHODS.cash_on_delivery ? dictionary.payment_method.cash_on_delivery : "",
  ].filter(Boolean);

  return (
    <footer className="bg-muted/40 mt-auto border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href={`/${lang}`} className="font-display w-fit text-2xl font-medium tracking-tight">
            {settings.SITE_NAME}
          </Link>
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
            {localized(settings.SITE_DESCRIPTION, locale)}
          </p>
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

        <FooterColumn title={text.shop} links={shop_links} />
        <FooterColumn title={text.help} links={help_links} />

        <div className="flex flex-col gap-3">
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
      </div>

      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            {text.rights.replace("{year}", String(new Date().getFullYear())).replace("{site_name}", settings.SITE_NAME)}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {payment_methods.length > 0 && (
              <span>
                {text.payments}: {payment_methods.join(" · ")}
              </span>
            )}
            {/* useSearchParams inside: needs a Suspense boundary on static pages. */}
            <Suspense>
              <LanguageSwitcher
                lang={lang}
                label={text.language}
                options={LOCALES.map((value) => ({ value, label: language_names.of(value) ?? value }))}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
