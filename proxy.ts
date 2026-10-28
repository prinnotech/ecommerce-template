import { i18nRouter } from "next-i18n-router";
import type { NextRequest } from "next/server";

import i18n_config, { LOCALE_COOKIE, LOCALES } from "@/i18nConfig";
import { detectLocale } from "@/lib/locale/detect-locale";
import { AUTH_COOKIE } from "@/lib/pocketbase/auth-cookie";
import { updateSession } from "@/lib/pocketbase/pocketbase-proxy";
import { getProxySetting } from "@/lib/site-settings-proxy";

// 1. Locale routing. A URL without a locale goes to the visitor's saved choice, else their
//    country (host header or IP lookup), else browser language, else the DEFAULT_LOCALE setting.
// 2. Session refresh, only when an auth cookie exists. No permission decisions here.
// Tracking capture (§8) is added when ad tracking is set up.
export async function proxy(request: NextRequest) {
  const default_locale = await getProxySetting("DEFAULT_LOCALE");

  // Only first visits without a locale need detection; it may call the IP lookup.
  const needs_detection = !hasLocalePrefix(request.nextUrl.pathname) && !hasSavedLocale(request);
  const detected_locale = needs_detection ? await detectLocale(request, default_locale) : default_locale;

  const response = i18nRouter(request, {
    ...i18n_config,
    defaultLocale: default_locale,
    localeDetector: () => detected_locale,
  });

  if (request.cookies.has(AUTH_COOKIE)) await updateSession(request, response);

  return response;
}

function hasLocalePrefix(pathname: string): boolean {
  return LOCALES.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
}

function hasSavedLocale(request: NextRequest): boolean {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  return (LOCALES as readonly string[]).includes(saved);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
