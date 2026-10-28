"use client";

import { useEffect } from "react";

import { useCartStore } from "@/store/cart-store";

// Loads the saved cart from localStorage once the page has hydrated (see skipHydration).
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  return null;
}
