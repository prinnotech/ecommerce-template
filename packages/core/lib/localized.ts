import { z } from "zod";

import { FALLBACK_LOCALE, isLocale, type Locale } from "@repo/core/i18nConfig";

// Catalog, theme and legal text stored per language: { en, es, it, fr, … }. Any language the store
// adds (Settings → Languages) is one more key; missing languages fall back.
export const locale_code_schema = z.string().refine(isLocale, "invalid");
export const localized_text_schema = z.record(locale_code_schema, z.string());
export type LocalizedText = z.infer<typeof localized_text_schema>;

export function localized(value: unknown, lang: Locale, fallback_lang: Locale = FALLBACK_LOCALE): string {
  const parsed = localized_text_schema.safeParse(value);
  if (!parsed.success) return "";
  const text: LocalizedText = parsed.data;
  return text[lang] || text[fallback_lang] || Object.values(text).find(Boolean) || "";
}
