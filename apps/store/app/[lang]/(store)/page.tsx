import type { Metadata } from "next";

import { ThemeSections } from "@/components/sections/theme-sections";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const settings = await getSiteSettings();
  return buildPageMetadata({ lang, path: "", description: localized(settings.SITE_DESCRIPTION, lang as Locale) });
}

// The home page is the live theme's sections (Admin → Online store → Themes).
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const [theme, settings, dictionary] = await Promise.all([getLiveTheme(), getSiteSettings(), getDictionary(lang)]);
  return (
    <ThemeSections
      sections={theme.pages.home}
      theme={theme.settings}
      lang={lang}
      fallback_title={settings.SITE_NAME}
      empty_text={dictionary.store.home.empty}
    />
  );
}
