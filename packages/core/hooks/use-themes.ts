"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addTheme,
  deleteTheme,
  discardThemeDraft,
  duplicateTheme,
  getTheme,
  getThemes,
  publishTheme,
  renameTheme,
  restoreThemeVersion,
  saveThemeDraft,
} from "@repo/core/actions/themes";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { RenameThemeInput, SaveThemeDraftInput } from "@repo/core/lib/schemas/theme";

export function useThemes() {
  return useQuery({ queryKey: query_keys.themes, queryFn: async () => unwrap(await getThemes()) });
}

export function useTheme(id: string) {
  return useQuery({
    queryKey: query_keys.theme(id),
    queryFn: async () => unwrap(await getTheme({ id })),
    // The editor owns the draft while it's open; refetching would overwrite what's being typed.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

// Every theme mutation can change the library (names, live badge, "unpublished changes").
function useInvalidateThemes() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.themes, exact: true });
}

function useInvalidateTheme() {
  const query_client = useQueryClient();
  return (id: string) => query_client.invalidateQueries({ queryKey: query_keys.theme(id) });
}

export function useAddTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: async (template: string) => unwrap(await addTheme({ template })),
    onSuccess: () => invalidate(),
  });
}

export function useDuplicateTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await duplicateTheme({ id })),
    onSuccess: () => invalidate(),
  });
}

export function useRenameTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: async (input: RenameThemeInput) => unwrap(await renameTheme(input)),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteTheme({ id })),
    onSuccess: () => invalidate(),
  });
}

export function useSaveThemeDraft() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: async (input: SaveThemeDraftInput) => unwrap(await saveThemeDraft(input)),
    onSuccess: () => invalidate(),
  });
}

export function usePublishTheme() {
  const invalidate = useInvalidateThemes();
  const invalidateTheme = useInvalidateTheme();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await publishTheme({ id })),
    // Returned, so the caller's onSuccess runs once the theme has been reloaded.
    onSuccess: (_data, id) => Promise.all([invalidate(), invalidateTheme(id)]),
  });
}

// Both replace the draft on the server, so the editor reloads it afterwards.
export function useRestoreThemeVersion() {
  const invalidate = useInvalidateThemes();
  const invalidateTheme = useInvalidateTheme();
  return useMutation({
    mutationFn: async (input: { id: string; published_at: string }) => unwrap(await restoreThemeVersion(input)),
    onSuccess: (_data, input) => Promise.all([invalidate(), invalidateTheme(input.id)]),
  });
}

export function useDiscardThemeDraft() {
  const invalidate = useInvalidateThemes();
  const invalidateTheme = useInvalidateTheme();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await discardThemeDraft({ id })),
    // Returned, so the caller's onSuccess runs once the theme has been reloaded.
    onSuccess: (_data, id) => Promise.all([invalidate(), invalidateTheme(id)]),
  });
}
