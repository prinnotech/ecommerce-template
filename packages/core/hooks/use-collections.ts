"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCollection,
  deleteCollection,
  getCollection,
  getCollections,
  setCollectionProducts,
  updateCollection,
} from "@repo/core/actions/collections";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { CollectionInput } from "@repo/core/lib/schemas/collections";

export function useCollections() {
  return useQuery({ queryKey: query_keys.collections, queryFn: async () => unwrap(await getCollections()) });
}

export function useCollection(id: string) {
  return useQuery({ queryKey: query_keys.collection(id), queryFn: async () => unwrap(await getCollection(id)) });
}

function useInvalidate() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.collections });
}

export function useCreateCollection() {
  const invalidate = useInvalidate();
  return useMutation({
    // Products picked on the new page are saved right after the collection exists.
    mutationFn: async (input: { collection: CollectionInput; product_ids: string[] }) => {
      const created = unwrap(await createCollection(input.collection));
      if (input.collection.kind === "manual" && input.product_ids.length > 0) {
        unwrap(await setCollectionProducts({ id: created.id, product_ids: input.product_ids }));
      }
      return created;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCollection(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { collection: CollectionInput; product_ids: string[] | null }) => {
      unwrap(await updateCollection({ id, collection: input.collection }));
      if (input.product_ids) unwrap(await setCollectionProducts({ id, product_ids: input.product_ids }));
      return null;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCollection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCollection(id)),
    onSuccess: invalidate,
  });
}
