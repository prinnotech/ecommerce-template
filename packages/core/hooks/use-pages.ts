"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createPage, deletePage, getPages, savePageSections, updatePage } from "@repo/core/actions/pages";
import { getMedia, uploadMedia } from "@repo/core/actions/media";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { CreatePageInput, SavePageSectionsInput, UpdatePageInput } from "@repo/core/lib/schemas/pages";

export function usePages() {
  return useQuery({ queryKey: query_keys.pages, queryFn: async () => unwrap(await getPages()) });
}

function useInvalidatePages() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.pages });
}

export function useCreatePage() {
  const invalidate = useInvalidatePages();
  return useMutation({
    mutationFn: async (input: CreatePageInput) => unwrap(await createPage(input)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePage() {
  const invalidate = useInvalidatePages();
  return useMutation({
    mutationFn: async (input: UpdatePageInput) => unwrap(await updatePage(input)),
    onSuccess: () => invalidate(),
  });
}

// Autosave from the theme editor: the editor keeps its own copy, so nothing is refetched.
export function useSavePageSections() {
  return useMutation({ mutationFn: async (input: SavePageSectionsInput) => unwrap(await savePageSections(input)) });
}

export function useDeletePage() {
  const invalidate = useInvalidatePages();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deletePage({ id })),
    onSuccess: () => invalidate(),
  });
}

export function useMedia(is_enabled: boolean) {
  return useQuery({
    queryKey: query_keys.media,
    queryFn: async () => unwrap(await getMedia()),
    enabled: is_enabled,
  });
}

export function useUploadMedia() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form_data = new FormData();
      form_data.set("file", file);
      return unwrap(await uploadMedia(form_data));
    },
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.media }),
  });
}
