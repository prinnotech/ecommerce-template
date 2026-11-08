"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addDomain,
  checkDomain,
  clearPrimaryDomain,
  getDomains,
  removeDomain,
  setPrimaryDomain,
} from "@repo/core/actions/domains";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { AddDomainInput, DomainTarget } from "@repo/core/lib/schemas/domains";

const REFRESH_MS = 30_000;

// Re-reads the list every 30 s while a domain is still on its way to "active".
export function useDomains() {
  return useQuery({
    queryKey: query_keys.domains,
    queryFn: async () => unwrap(await getDomains()),
    refetchInterval: (query) =>
      query.state.data?.domains.some((domain) => domain.status === "pending" || domain.status === "verifying")
        ? REFRESH_MS
        : false,
  });
}

function useInvalidateDomains() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.domains });
}

export function useAddDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({
    mutationFn: async (input: AddDomainInput) => unwrap(await addDomain(input)),
    onSuccess: () => invalidate(),
  });
}

export function useCheckDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await checkDomain({ id })),
    onSuccess: () => invalidate(),
  });
}

export function useSetPrimaryDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await setPrimaryDomain({ id })),
    onSuccess: () => invalidate(),
  });
}

export function useClearPrimaryDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({
    mutationFn: async (target: DomainTarget) => unwrap(await clearPrimaryDomain({ target })),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeDomain({ id })),
    onSuccess: () => invalidate(),
  });
}
