import "server-only";

import { cache } from "react";

import type admin_en from "@repo/core/dictionaries/admin/en.json";
import type en from "@repo/core/dictionaries/en.json";
import { FALLBACK_LOCALE, isBuiltInLocale, isLocale, type BuiltInLocale } from "@repo/core/i18nConfig";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { applyText } from "@repo/core/lib/translations";

export { isLocale };

// Shared + store text. The admin's own text lives in dictionaries/admin/ so the store never loads it.
export type Dictionary = typeof en;
export type AdminDictionary = Dictionary & typeof admin_en;

const LOADERS: Record<BuiltInLocale, () => Promise<Dictionary>> = {
  en: () => import("@repo/core/dictionaries/en.json").then((module) => module.default),
  es: () => import("@repo/core/dictionaries/es.json").then((module) => module.default),
  it: () => import("@repo/core/dictionaries/it.json").then((module) => module.default),
};

const ADMIN_LOADERS: Record<BuiltInLocale, () => Promise<typeof admin_en>> = {
  en: () => import("@repo/core/dictionaries/admin/en.json").then((module) => module.default),
  es: () => import("@repo/core/dictionaries/admin/es.json").then((module) => module.default),
  it: () => import("@repo/core/dictionaries/admin/it.json").then((module) => module.default),
};

// The shipped dictionary for the language (English for languages without one), with the text
// edited in Settings → Languages on top. Once per request.
export const getDictionary = cache(async (lang: string): Promise<Dictionary> => {
  const [base, settings] = await Promise.all([
    LOADERS[isBuiltInLocale(lang) ? lang : FALLBACK_LOCALE](),
    getSiteSettings(),
  ]);
  const edits = settings.UI_TRANSLATIONS[lang];
  return edits && Object.keys(edits).length > 0 ? applyText(base, edits) : base;
});

// The shipped dictionary only, without edits (Settings → Languages compares against it).
export async function getBaseDictionary(lang: string): Promise<Dictionary> {
  return LOADERS[isBuiltInLocale(lang) ? lang : FALLBACK_LOCALE]();
}

// The admin is in English, Spanish or Italian (the shipped dictionaries).
export async function getAdminDictionary(lang: string): Promise<AdminDictionary> {
  const locale = isBuiltInLocale(lang) ? lang : FALLBACK_LOCALE;
  const [shared, admin] = await Promise.all([LOADERS[locale](), ADMIN_LOADERS[locale]()]);
  return { ...shared, ...admin };
}
