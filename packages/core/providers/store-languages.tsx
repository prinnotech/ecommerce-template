"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Locale } from "@repo/core/i18nConfig";
import { DEFAULT_LANGUAGES, storeLocales, type StoreLanguage } from "@repo/core/lib/languages";

// The store's languages (the LANGUAGES setting) for the admin's per-language fields: every
// "EN · ES · IT" tab row shows these. Set once in the admin's root layout from the server.
const StoreLanguagesContext = createContext<readonly StoreLanguage[]>(DEFAULT_LANGUAGES);

export function StoreLanguagesProvider({
  languages,
  children,
}: {
  languages: readonly StoreLanguage[];
  children: ReactNode;
}) {
  return <StoreLanguagesContext.Provider value={languages}>{children}</StoreLanguagesContext.Provider>;
}

export function useStoreLanguages(): readonly StoreLanguage[] {
  return useContext(StoreLanguagesContext);
}

export function useStoreLocales(): Locale[] {
  return storeLocales(useContext(StoreLanguagesContext));
}
