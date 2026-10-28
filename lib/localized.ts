import { z } from "zod";

import { FALLBACK_LOCALE, LOCALES, type Locale } from "@/i18nConfig";

// Catalog and legal text stored per locale: { en, es, it }. Missing locales fall back.
export const localized_text_schema = z.partialRecord(z.enum(LOCALES), z.string());
export type LocalizedText = z.infer<typeof localized_text_schema>;

export function localized(value: unknown, lang: Locale, fallback_lang: Locale = FALLBACK_LOCALE): string {
  const parsed = localized_text_schema.safeParse(value);
  if (!parsed.success) return "";
  const text = parsed.data;
  return text[lang] || text[fallback_lang] || Object.values(text).find(Boolean) || "";
}
