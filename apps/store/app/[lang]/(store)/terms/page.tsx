import type { Metadata } from "next";

import { ContentPage } from "@/components/storefront/content-page";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/terms", title: dictionary.pages.terms.meta_title });
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);

  return (
    <ContentPage
      eyebrow={dictionary.pages.terms.eyebrow}
      title={dictionary.pages.terms.title}
      text={localized(settings.TERMS_AND_CONDITIONS, lang as Locale)}
      fallback={dictionary.pages.missing}
      contact={{ href: `/${lang}/contact`, label: dictionary.pages.contact_cta }}
    />
  );
}
