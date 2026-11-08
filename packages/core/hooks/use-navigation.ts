"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getNavigation, saveNavigation } from "@repo/core/actions/navigation";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { Navigation } from "@repo/core/lib/schemas/navigation";

export function useNavigation() {
  return useQuery({
    queryKey: query_keys.navigation,
    queryFn: async () => unwrap(await getNavigation()),
    // The editor owns the menus while it's open; a refetch would overwrite what's being typed.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

export function useSaveNavigation() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (navigation: Navigation) => unwrap(await saveNavigation(navigation)),
    onSuccess: (_data, navigation) => query_client.setQueryData(query_keys.navigation, navigation),
  });
}
