"use client";

import { useWishlistMerge } from "@repo/core/hooks/use-wishlist";

// Moves a guest's saved products to their account once they sign in. Renders nothing.
export function WishlistSync() {
  useWishlistMerge();
  return null;
}
