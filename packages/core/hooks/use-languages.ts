"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAiSettings,
  getLanguages,
  getLanguageTexts,
  saveAiSettings,
  saveLanguages,
  saveLanguageTexts,
  testAi,
  translateLanguageTexts,
} from "@repo/core/actions/languages";
import {
  getContentTranslations,
  saveContentTranslation,
  translateContent,
} from "@repo/core/actions/content-translations";
import type { Locale } from "@repo/core/i18nConfig";
import { unwrap } from "@repo/core/lib/action-result";
import type { ContentKind } from "@repo/core/lib/content-translation";
import type { StoreLanguage } from "@repo/core/lib/languages";
import { query_keys } from "@repo/core/lib/query-keys";
import type { SaveAiSettingsInput } from "@repo/core/lib/schemas/ai";
import type { FlatText } from "@repo/core/lib/translations";

// Settings → AI

export function useAiSettings() {
  return useQuery({ queryKey: query_keys.ai_settings, queryFn: async () => unwrap(await getAiSettings()) });
}

export function useSaveAiSettings() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAiSettingsInput) => unwrap(await saveAiSettings(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.ai_settings }),
  });
}

export function useTestAi() {
  return useMutation({ mutationFn: async () => unwrap(await testAi()) });
}

// Settings → Languages

export function useLanguages() {
  return useQuery({ queryKey: query_keys.languages, queryFn: async () => unwrap(await getLanguages()) });
}

export function useSaveLanguages() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { languages: StoreLanguage[]; default_locale: Locale }) =>
      unwrap(await saveLanguages(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.languages }),
  });
}

export function useLanguageTexts(locale: Locale) {
  return useQuery({
    queryKey: query_keys.language_texts(locale),
    queryFn: async () => unwrap(await getLanguageTexts({ locale })),
  });
}

export function useSaveLanguageTexts(locale: Locale) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (texts: FlatText) => unwrap(await saveLanguageTexts({ locale, texts })),
    onSuccess: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.language_texts(locale) }),
        query_client.invalidateQueries({ queryKey: query_keys.languages }),
      ]),
  });
}

// One batch of AI drafts; the editor calls it batch by batch so it can show progress and stop.
export function useTranslateLanguageTexts(locale: Locale) {
  return useMutation({
    mutationFn: async (keys: string[]) => unwrap(await translateLanguageTexts({ locale, keys })),
  });
}

// Settings → Languages → content tabs (products, categories, collections, pages)

export function useContentTranslations(locale: Locale, kind: ContentKind, page: number, search: string) {
  return useQuery({
    queryKey: [...query_keys.content_translations(locale, kind), page, search],
    queryFn: async () => unwrap(await getContentTranslations({ locale, kind, page, search })),
  });
}

export function useSaveContentTranslation(locale: Locale, kind: ContentKind) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; fields: Record<string, string> }) =>
      unwrap(await saveContentTranslation({ locale, kind, ...input })),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.content_translations(locale, kind) }),
  });
}

export function useTranslateContent(locale: Locale, kind: ContentKind) {
  return useMutation({
    mutationFn: async (texts: Record<string, string>) => unwrap(await translateContent({ locale, kind, texts })),
  });
}
