import type { Metadata } from "next";

import { ContactDetails } from "@/components/storefront/contact-details";
import { ContentPage } from "@/components/storefront/content-page";
import type { Locale } from "@/i18nConfig";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { getSiteSettings } from "@/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);
  return buildPageMetadata({
    lang,
    path: "/about",
    title: dictionary.pages.about.meta_title,
    description: localized(settings.SITE_DESCRIPTION, lang as Locale),
  });
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);

  return (
    <ContentPage
      eyebrow={dictionary.pages.about.eyebrow}
      title={dictionary.pages.about.title}
      text={localized(settings.ABOUT_CONTENT, lang as Locale)}
      fallback={localized(settings.SITE_DESCRIPTION, lang as Locale) || dictionary.pages.missing}
      contact={{ href: `/${lang}/contact`, label: dictionary.pages.contact_cta }}
      aside={
        <div className="bg-muted/40 flex flex-col gap-5 rounded-xl border p-6">
          <h2 className="font-medium">{dictionary.pages.visit_title}</h2>
          <ContactDetails settings={settings} lang={lang} labels={dictionary.contact} />
        </div>
      }
    />
  );
}
