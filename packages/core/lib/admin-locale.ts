import "server-only";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import type { Locale } from "@repo/core/i18nConfig";
import { getCaller } from "@repo/core/lib/auth";
import { isLocale } from "@repo/core/lib/i18n";
import { browserLocale } from "@repo/core/lib/locale/detect-locale";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// The admin has no language in its URLs: each staff member picks one (profile menu), saved on their
// team profile and in this cookie (the cookie also covers the sign-in pages, before there's a session).
// Without a choice: the browser's language, then the DEFAULT_LOCALE setting.
export const ADMIN_LOCALE_COOKIE = "admin_locale";

export const getAdminLocale = cache(async (): Promise<Locale> => {
  const [caller, cookie_store, header_list] = await Promise.all([getCaller(), cookies(), headers()]);
  if (caller && isLocale(caller.locale)) return caller.locale;
  const saved = cookie_store.get(ADMIN_LOCALE_COOKIE)?.value ?? "";
  if (isLocale(saved)) return saved;
  return browserLocale(header_list.get("accept-language")) ?? (await getSiteSetting("DEFAULT_LOCALE"));
});

// Admin pages are private: a title with the store name, never indexed.
export async function buildAdminMetadata(title?: string): Promise<Metadata> {
  const site_name = await getSiteSetting("SITE_NAME");
  return {
    title: title ? `${title} · ${site_name}` : site_name,
    robots: { index: false, follow: false },
  };
}
