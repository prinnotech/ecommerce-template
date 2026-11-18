import type { Config } from "next-i18n-router/dist/types";

// The languages that ship with JSON dictionaries in the repo. A store can add any other language
// in Settings → Languages (the LANGUAGES setting): its text starts from English and is translated
// there (UI_TRANSLATIONS), by hand or with AI.
export const LOCALES = ["en", "es", "it"] as const;
export type BuiltInLocale = (typeof LOCALES)[number];

// A language code: "fr", "de", "pt-BR". Which ones a store uses is the LANGUAGES setting.
export type Locale = string;

// Build-time fallback. At runtime the proxy uses the DEFAULT_LOCALE site setting.
export const FALLBACK_LOCALE = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

const LOCALE_CODE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

// A well-formed language code. Whether the store has that language is a separate question
// (lib/languages.ts).
export function isLocale(value: string): value is Locale {
  return LOCALE_CODE.test(value);
}

export function isBuiltInLocale(value: string): value is BuiltInLocale {
  return (LOCALES as readonly string[]).includes(value);
}

const i18n_config: Config = {
  locales: [...LOCALES],
  defaultLocale: FALLBACK_LOCALE,
  localeCookie: LOCALE_COOKIE,
  prefixDefault: true,
};

export default i18n_config;
