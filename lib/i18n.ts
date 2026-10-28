import "server-only";

import type en from "@/dictionaries/en.json";
import { FALLBACK_LOCALE, LOCALES, type Locale } from "@/i18nConfig";

export type Dictionary = typeof en;

const LOADERS: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  es: () => import("@/dictionaries/es.json").then((module) => module.default),
  it: () => import("@/dictionaries/it.json").then((module) => module.default),
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export async function getDictionary(lang: string): Promise<Dictionary> {
  return LOADERS[isLocale(lang) ? lang : FALLBACK_LOCALE]();
}
