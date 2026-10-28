import type { Config } from "next-i18n-router/dist/types";

export const LOCALES = ["en", "es", "it"] as const;
export type Locale = (typeof LOCALES)[number];

// Build-time fallback. At runtime the proxy uses the DEFAULT_LOCALE site setting.
export const FALLBACK_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

const i18n_config: Config = {
  locales: LOCALES,
  defaultLocale: FALLBACK_LOCALE,
  localeCookie: LOCALE_COOKIE,
  prefixDefault: true,
};

export default i18n_config;
