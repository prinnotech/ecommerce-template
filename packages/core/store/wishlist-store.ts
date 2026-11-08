import { create } from "zustand";
import { persist } from "zustand/middleware";

// A guest's wishlist: product ids only, in the browser. Signed-in customers keep theirs on the
// server (actions/wishlist.ts); this list moves there on sign-in (hooks/use-wishlist.ts).

export const MAX_WISHLIST = 200;

type WishlistState = {
  product_ids: string[];
  toggle: (product_id: string) => void;
  clear: () => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      product_ids: [],
      toggle: (product_id) =>
        set((state) => ({
          product_ids: state.product_ids.includes(product_id)
            ? state.product_ids.filter((id) => id !== product_id)
            : [product_id, ...state.product_ids].slice(0, MAX_WISHLIST),
        })),
      clear: () => set({ product_ids: [] }),
    }),
    {
      name: "wishlist",
      version: 1,
      // Rehydrated after mount by CartHydrator, like the cart, so the first render matches the server.
      skipHydration: true,
      partialize: (state) => ({ product_ids: state.product_ids }),
    },
  ),
);
