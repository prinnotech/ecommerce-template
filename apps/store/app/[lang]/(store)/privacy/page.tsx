import type { Metadata } from "next";

import { ContentPage } from "@/components/storefront/content-page";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/privacy", title: dictionary.pages.privacy.meta_title });
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);

  return (
    <ContentPage
      eyebrow={dictionary.pages.privacy.eyebrow}
      title={dictionary.pages.privacy.title}
      text={localized(settings.PRIVACY_POLICY, lang as Locale)}
      fallback={dictionary.pages.missing}
      contact={{ href: `/${lang}/contact`, label: dictionary.pages.contact_cta }}
    />
  );
}
