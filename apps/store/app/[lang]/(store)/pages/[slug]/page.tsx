import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStorePage } from "@repo/core/actions/pages";
import { ThemeSections } from "@/components/sections/theme-sections";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { localized } from "@repo/core/lib/localized";
import { getLiveTheme } from "@repo/core/lib/theme-server";

// Rendered on the first visit, then cached; saving a page in the admin refreshes the store.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/pages/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = await getStorePage(slug);
  if (!page.ok) return { robots: { index: false } };
  const locale = lang as Locale;
  return buildPageMetadata({
    lang,
    path: `/pages/${slug}`,
    title: localized(page.data.seo.title, locale) || localized(page.data.title, locale),
    description: localized(page.data.seo.description, locale),
  });
}

// A custom page (Online store → Pages), built from the same sections as the theme's pages.
export default async function CustomPage({ params }: PageProps<"/[lang]/pages/[slug]">) {
  const { lang, slug } = await params;
  const [page, theme] = await Promise.all([getStorePage(slug), getLiveTheme()]);
  if (!page.ok) notFound();
  return (
    <div className="pb-10">
      <ThemeSections
        sections={page.data.sections}
        theme={theme.settings}
        lang={lang}
        fallback_title={localized(page.data.title, lang as Locale)}
      />
    </div>
  );
}
