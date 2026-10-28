"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAllSettings, resetSetting, updateSetting } from "@/app/actions/site-settings";
import { unwrap } from "@/lib/action-result";
import { query_keys } from "@/lib/query-keys";

// Dashboard only: every setting with metadata (needs settings.view).
export function useAllSettings() {
  return useQuery({ queryKey: query_keys.all_settings, queryFn: async () => unwrap(await getAllSettings()) });
}

export function useUpdateSetting() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; value: unknown }) => unwrap(await updateSetting(input)),
    onSuccess: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.all_settings }),
        query_client.invalidateQueries({ queryKey: query_keys.site_settings }),
      ]),
  });
}

export function useResetSetting() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string }) => unwrap(await resetSetting(input)),
    onSuccess: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.all_settings }),
        query_client.invalidateQueries({ queryKey: query_keys.site_settings }),
      ]),
  });
}
