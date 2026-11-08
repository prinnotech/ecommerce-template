import "server-only";

import type admin_en from "@repo/core/dictionaries/admin/en.json";
import type en from "@repo/core/dictionaries/en.json";
import { FALLBACK_LOCALE, isLocale, type Locale } from "@repo/core/i18nConfig";

export { isLocale };

// Shared + store text. The admin's own text lives in dictionaries/admin/ so the store never loads it.
export type Dictionary = typeof en;
export type AdminDictionary = Dictionary & typeof admin_en;

const LOADERS: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("@repo/core/dictionaries/en.json").then((module) => module.default),
  es: () => import("@repo/core/dictionaries/es.json").then((module) => module.default),
  it: () => import("@repo/core/dictionaries/it.json").then((module) => module.default),
};

const ADMIN_LOADERS: Record<Locale, () => Promise<typeof admin_en>> = {
  en: () => import("@repo/core/dictionaries/admin/en.json").then((module) => module.default),
  es: () => import("@repo/core/dictionaries/admin/es.json").then((module) => module.default),
  it: () => import("@repo/core/dictionaries/admin/it.json").then((module) => module.default),
};

export async function getDictionary(lang: string): Promise<Dictionary> {
  return LOADERS[isLocale(lang) ? lang : FALLBACK_LOCALE]();
}

export async function getAdminDictionary(lang: string): Promise<AdminDictionary> {
  const locale = isLocale(lang) ? lang : FALLBACK_LOCALE;
  const [shared, admin] = await Promise.all([LOADERS[locale](), ADMIN_LOADERS[locale]()]);
  return { ...shared, ...admin };
}
