"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { addToWishlist, getMyWishlistIds, removeFromWishlist } from "@repo/core/actions/wishlist";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import { useWishlistStore } from "@repo/core/store/wishlist-store";

function subscribeNever() {
  return () => undefined;
}
const isClient = () => true;
const isServer = () => false;

// The signed-in customer's ids, or null when signed out.
function useServerWishlist() {
  return useQuery({ queryKey: query_keys.wishlist, queryFn: async () => unwrap(await getMyWishlistIds()) });
}

function useAddToWishlist() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (product_ids: string[]) => unwrap(await addToWishlist({ product_ids })),
    onSettled: () => query_client.invalidateQueries({ queryKey: query_keys.wishlist }),
  });
}

// One wishlist API for guests and customers: ids from the server when signed in, else from the
// browser (store/wishlist-store.ts).
export function useWishlist() {
  const query_client = useQueryClient();
  // The server renders every heart empty; the first client render matches it, then shows the list
  // (otherwise React keeps the server's attributes after a hydration mismatch).
  const is_hydrated = useSyncExternalStore(subscribeNever, isClient, isServer);
  const server = useServerWishlist();
  const local_ids = useWishlistStore((state) => state.product_ids);
  const toggleLocal = useWishlistStore((state) => state.toggle);
  const is_signed_in = is_hydrated && Array.isArray(server.data);
  const ids = !is_hydrated ? [] : is_signed_in ? (server.data ?? []) : local_ids;
  const add = useAddToWishlist();
  const remove = useMutation({
    mutationFn: async (product_id: string) => unwrap(await removeFromWishlist({ product_id })),
    onSettled: () => query_client.invalidateQueries({ queryKey: query_keys.wishlist }),
  });

  function toggle(product_id: string) {
    if (!is_signed_in) {
      toggleLocal(product_id);
      return;
    }
    // Shown right away; the invalidation after the mutation brings the server's list back.
    const is_saved = ids.includes(product_id);
    query_client.setQueryData<string[] | null>(query_keys.wishlist, (current) =>
      is_saved ? (current ?? []).filter((id) => id !== product_id) : [product_id, ...(current ?? [])],
    );
    if (is_saved) remove.mutate(product_id);
    else add.mutate([product_id]);
  }

  return { ids, is_signed_in, has: (product_id: string) => ids.includes(product_id), toggle };
}

// Rendered once in the store layout: after sign-in, the ids saved as a guest move to the account.
export function useWishlistMerge() {
  const server = useServerWishlist();
  const local_ids = useWishlistStore((state) => state.product_ids);
  const clearLocal = useWishlistStore((state) => state.clear);
  const add = useAddToWishlist();
  const is_merging = useRef(false);
  const is_signed_in = Array.isArray(server.data);

  useEffect(() => {
    if (!is_signed_in || local_ids.length === 0 || is_merging.current) return;
    is_merging.current = true;
    add.mutate(local_ids, {
      onSuccess: () => clearLocal(),
      onSettled: () => {
        is_merging.current = false;
      },
    });
  }, [is_signed_in, local_ids, add, clearLocal]);
}
