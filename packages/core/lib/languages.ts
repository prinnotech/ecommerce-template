import { z } from "zod";

import { FALLBACK_LOCALE, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { locale_code_schema } from "@repo/core/lib/localized";

// The store's languages (Settings → Languages, the LANGUAGES setting). Published ones are routed
// and offered in the language switcher; unpublished ones can be filled in and previewed first.
// Pure helpers: safe in the proxy, server and client code.

export const store_language_schema = z.object({ code: locale_code_schema, is_published: z.boolean() });
export type StoreLanguage = z.infer<typeof store_language_schema>;

export const languages_schema = z
  .array(store_language_schema)
  .min(1)
  .max(30)
  .refine((list) => new Set(list.map((item) => item.code)).size === list.length, "duplicate")
  .refine((list) => list.some((item) => item.is_published), "none_published");

export const DEFAULT_LANGUAGES: StoreLanguage[] = LOCALES.map((code) => ({ code, is_published: true }));

export function publishedLocales(languages: readonly StoreLanguage[]): Locale[] {
  const published = languages.filter((item) => item.is_published).map((item) => item.code);
  return published.length > 0 ? published : [FALLBACK_LOCALE];
}

export function storeLocales(languages: readonly StoreLanguage[]): Locale[] {
  return languages.map((item) => item.code);
}

// "Français", "Deutsch": a language in its own name (for the store's switcher), or in another
// language (`in_lang`, for the admin). Falls back to the code.
export function languageName(code: Locale, in_lang: Locale = code): string {
  try {
    const name = new Intl.DisplayNames([in_lang], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(in_lang) + name.slice(1);
  } catch {
    // An unknown code for this runtime's Intl data: show the code itself.
    return code;
  }
}

// Languages an owner can add: common shop languages, in the admin's language, by name.
export const SUGGESTED_LANGUAGES: readonly Locale[] = [
  "en",
  "es",
  "it",
  "fr",
  "de",
  "pt",
  "pt-BR",
  "nl",
  "pl",
  "sv",
  "da",
  "nb",
  "fi",
  "cs",
  "ro",
  "hu",
  "el",
  "tr",
  "ru",
  "uk",
  "ar",
  "he",
  "ja",
  "ko",
  "zh",
  "hi",
];
