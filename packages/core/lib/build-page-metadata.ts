import "server-only";

import type { Metadata } from "next";

import { LOCALES } from "@repo/core/i18nConfig";
import { SITE_URL } from "@repo/core/lib/site-config";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

type PageMetadataInput = {
  lang: string;
  // Path after the locale, starting with "/" ("" for the home page).
  path: string;
  title?: string;
  description?: string;
  is_private?: boolean;
};

// Canonical, hreflang for every locale and OpenGraph, with the site name from settings.
export async function buildPageMetadata({
  lang,
  path,
  title,
  description,
  is_private,
}: PageMetadataInput): Promise<Metadata> {
  const site_name = await getSiteSetting("SITE_NAME");
  const favicon_url = await getSiteSetting("SITE_FAVICON_URL");
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]));
  const full_title = title ? `${title} | ${site_name}` : site_name;

  return {
    title: full_title,
    description,
    icons: favicon_url ? { icon: favicon_url } : undefined,
    alternates: { canonical: `${SITE_URL}/${lang}${path}`, languages },
    openGraph: {
      title: full_title,
      description,
      siteName: site_name,
      url: `${SITE_URL}/${lang}${path}`,
      locale: lang,
      type: "website",
    },
    robots: is_private ? { index: false, follow: false } : undefined,
  };
}
