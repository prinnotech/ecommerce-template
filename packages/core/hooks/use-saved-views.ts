"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createSavedView, deleteSavedView, getSavedViews } from "@repo/core/actions/saved-views";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { SavedViewInput, SavedViewResource } from "@repo/core/lib/schemas/admin";

export function useSavedViews(resource: SavedViewResource) {
  return useQuery({
    queryKey: query_keys.saved_views(resource),
    queryFn: async () => unwrap(await getSavedViews(resource)),
  });
}

export function useCreateSavedView() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SavedViewInput) => unwrap(await createSavedView(input)),
    onSuccess: (_data, input) => query_client.invalidateQueries({ queryKey: query_keys.saved_views(input.resource) }),
  });
}

export function useDeleteSavedView(resource: SavedViewResource) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteSavedView({ id })),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.saved_views(resource) }),
  });
}
