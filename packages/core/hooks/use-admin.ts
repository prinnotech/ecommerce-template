"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { searchAdmin, setAdminLocale } from "@repo/core/actions/admin";
import { uploadSiteAsset } from "@repo/core/actions/site-settings";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { AdminLocaleInput } from "@repo/core/lib/schemas/admin";

// Runs once the query has 2 characters (the action's minimum); keeps the last results while typing.
export function useAdminSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: query_keys.admin_search(trimmed),
    queryFn: async () => unwrap(await searchAdmin({ query: trimmed })),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// The caller refreshes the router afterwards so server components render in the new language.
export function useSetAdminLocale() {
  return useMutation({ mutationFn: async (input: AdminLocaleInput) => unwrap(await setAdminLocale(input)) });
}

// FormData: kind ("logo" | "favicon"), file. Returns the URL to save in the setting.
export function useUploadSiteAsset() {
  return useMutation({ mutationFn: async (form_data: FormData) => unwrap(await uploadSiteAsset(form_data)) });
}
