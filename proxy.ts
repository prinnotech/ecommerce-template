import { i18nRouter } from "next-i18n-router";
import type { NextRequest } from "next/server";

import i18n_config from "@/i18nConfig";
import { AUTH_COOKIE } from "@/lib/pocketbase/auth-cookie";
import { updateSession } from "@/lib/pocketbase/pocketbase-proxy";
import { getProxySetting } from "@/lib/site-settings-proxy";

// 1. Locale routing (browser language, then the DEFAULT_LOCALE setting).
// 2. Session refresh, only when an auth cookie exists. No permission decisions here.
// Tracking capture (§8) is added when ad tracking is set up.
export async function proxy(request: NextRequest) {
  const default_locale = await getProxySetting("DEFAULT_LOCALE");
  const response = i18nRouter(request, { ...i18n_config, defaultLocale: default_locale });

  if (request.cookies.has(AUTH_COOKIE)) await updateSession(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
