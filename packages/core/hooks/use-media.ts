"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteMedia, getMediaPage, updateMedia, uploadMedia } from "@repo/core/actions/media";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { MediaFilters, UpdateMediaInput } from "@repo/core/lib/schemas/media";

// Content → Files and the image pickers.

export function useMediaPage(filters: MediaFilters, is_enabled = true) {
  return useQuery({
    queryKey: query_keys.media(filters),
    queryFn: async () => unwrap(await getMediaPage(filters)),
    placeholderData: keepPreviousData,
    enabled: is_enabled,
  });
}

function useInvalidateMedia() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.media_all });
}

export function useUploadMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: async (file: File) => {
      const form_data = new FormData();
      form_data.set("file", file);
      return unwrap(await uploadMedia(form_data));
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: async (input: UpdateMediaInput) => unwrap(await updateMedia(input)),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteMedia(id)),
    onSuccess: () => invalidate(),
  });
}
