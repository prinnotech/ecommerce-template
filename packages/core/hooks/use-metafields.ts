"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMetafieldDefinition,
  deleteMetafieldDefinition,
  getMetafieldDefinitions,
  getMetafields,
  moveMetafieldDefinition,
  setMetafields,
  updateMetafieldDefinition,
} from "@repo/core/actions/metafields";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { MetafieldDefinitionInput, MetafieldOwner, SetMetafieldsInput } from "@repo/core/lib/schemas/metafields";

// Settings → Custom data.
export function useMetafieldDefinitions() {
  return useQuery({
    queryKey: query_keys.metafield_definitions,
    queryFn: async () => unwrap(await getMetafieldDefinitions()),
  });
}

function useInvalidateMetafields() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.metafields_all });
}

export function useCreateMetafieldDefinition() {
  const invalidate = useInvalidateMetafields();
  return useMutation({
    mutationFn: async (input: MetafieldDefinitionInput) => unwrap(await createMetafieldDefinition(input)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMetafieldDefinition() {
  const invalidate = useInvalidateMetafields();
  return useMutation({
    mutationFn: async (input: { id: string; definition: MetafieldDefinitionInput }) =>
      unwrap(await updateMetafieldDefinition(input)),
    onSuccess: () => invalidate(),
  });
}

export function useMoveMetafieldDefinition() {
  const invalidate = useInvalidateMetafields();
  return useMutation({
    mutationFn: async (input: { id: string; direction: -1 | 1 }) => unwrap(await moveMetafieldDefinition(input)),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteMetafieldDefinition() {
  const invalidate = useInvalidateMetafields();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteMetafieldDefinition(id)),
    onSuccess: () => invalidate(),
  });
}

// The Custom fields card of one product, collection or customer.
export function useMetafields(owner: MetafieldOwner, owner_key: string) {
  return useQuery({
    queryKey: query_keys.metafields(owner, owner_key),
    queryFn: async () => unwrap(await getMetafields({ owner, owner_key })),
  });
}

export function useSetMetafields() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetMetafieldsInput) => unwrap(await setMetafields(input)),
    onSuccess: (_values, input) =>
      query_client.invalidateQueries({ queryKey: query_keys.metafields(input.owner, input.owner_key) }),
  });
}
