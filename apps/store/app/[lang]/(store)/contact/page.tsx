import type { Metadata } from "next";

import { ThemeSections } from "@/components/sections/theme-sections";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { getLiveTheme } from "@repo/core/lib/theme-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/contact",
    title: dictionary.contact.meta_title,
    description: dictionary.contact.meta_description,
  });
}

// The theme's Contact page; the form is a section the theme can move.
export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  const [dictionary, theme] = await Promise.all([getDictionary(lang), getLiveTheme()]);
  return (
    <div className="pb-10">
      <ThemeSections
        sections={theme.pages.contact}
        theme={theme.settings}
        lang={lang}
        fallback_title={dictionary.contact.title}
      />
    </div>
  );
}
