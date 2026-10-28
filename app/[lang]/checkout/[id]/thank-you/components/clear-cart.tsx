"use client";

import { useEffect } from "react";

import { useCartHydrated } from "@/hooks/use-cart-hydrated";
import { useCartStore } from "@/store/cart-store";

// The order exists, so the saved cart is done. Waits for hydration so the cleared cart isn't
// overwritten by the stored one loading afterwards.
export function ClearCart() {
  const is_hydrated = useCartHydrated();
  const clear = useCartStore((state) => state.clear);

  useEffect(() => {
    if (is_hydrated) clear();
  }, [is_hydrated, clear]);

  return null;
}
