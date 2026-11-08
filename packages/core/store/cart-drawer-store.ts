import { create } from "zustand";

// Global cart-drawer open state (audit X7). Separate from the cart contents so the drawer
// can be opened from anywhere: the product page and the header cart button.
type CartDrawerState = {
  is_open: boolean;
  open: () => void;
  close: () => void;
};

export const useCartDrawerStore = create<CartDrawerState>()((set) => ({
  is_open: false,
  open: () => set({ is_open: true }),
  close: () => set({ is_open: false }),
}));
