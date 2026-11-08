import type { Metadata } from "next";

import { ThemeSections } from "@/components/sections/theme-sections";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";

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

// The theme's About page (Admin → Online store → Themes → Customize → About).
export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  const [dictionary, theme] = await Promise.all([getDictionary(lang), getLiveTheme()]);
  return (
    <div className="pb-10">
      <ThemeSections
        sections={theme.pages.about}
        theme={theme.settings}
        lang={lang}
        fallback_title={dictionary.pages.about.title}
      />
    </div>
  );
}
