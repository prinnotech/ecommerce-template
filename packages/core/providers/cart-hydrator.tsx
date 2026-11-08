"use client";

import { useEffect } from "react";

import { writeCartCookie } from "@repo/core/lib/cart-cookie";
import { useCartStore } from "@repo/core/store/cart-store";
import { useWishlistStore } from "@repo/core/store/wishlist-store";

// Loads the saved cart (and a guest's wishlist) from localStorage once the page has hydrated (see skipHydration),
// and mirrors it to a cookie so the cart page can render on the server first (audit X8).
export function CartHydrator() {
  useEffect(() => {
    void (async () => {
      await Promise.all([useCartStore.persist.rehydrate(), useWishlistStore.persist.rehydrate()]);
      writeCartCookie(useCartStore.getState().lines);
    })();
    return useCartStore.subscribe((state) => writeCartCookie(state.lines));
  }, []);
  return null;
}
