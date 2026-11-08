"use client";

import { useSyncExternalStore } from "react";

import { useCartStore } from "@repo/core/store/cart-store";

// True once the saved cart has been loaded from localStorage (false on the server and first render).
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (on_change) => useCartStore.persist.onFinishHydration(on_change),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}
