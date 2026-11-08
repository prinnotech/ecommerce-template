import { create } from "zustand";
import { persist } from "zustand/middleware";

// Only ids and quantities live here (no prices or names: those are server data and are
// always re-read, and re-priced on the server at checkout).
export type CartLine = { variant_id: string; quantity: number };

export const MAX_LINE_QUANTITY = 20;

type CartState = {
  lines: CartLine[];
  // Returns the quantity actually in the cart for that variant afterwards.
  addItem: (variant_id: string, quantity: number, max_quantity?: number) => number;
  setQuantity: (variant_id: string, quantity: number) => void;
  removeItem: (variant_id: string) => void;
  clear: () => void;
};

function clampQuantity(quantity: number, max_quantity = MAX_LINE_QUANTITY): number {
  return Math.max(0, Math.min(Math.floor(quantity), max_quantity, MAX_LINE_QUANTITY));
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addItem: (variant_id, quantity, max_quantity) => {
        const current = get().lines.find((line) => line.variant_id === variant_id)?.quantity ?? 0;
        const next = clampQuantity(current + quantity, max_quantity);
        set((state) => ({
          lines: state.lines.some((line) => line.variant_id === variant_id)
            ? state.lines.map((line) => (line.variant_id === variant_id ? { ...line, quantity: next } : line))
            : [...state.lines, { variant_id, quantity: next }],
        }));
        return next;
      },
      setQuantity: (variant_id, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((line) => (line.variant_id === variant_id ? { ...line, quantity: clampQuantity(quantity) } : line))
            .filter((line) => line.quantity > 0),
        })),
      removeItem: (variant_id) =>
        set((state) => ({ lines: state.lines.filter((line) => line.variant_id !== variant_id) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "cart",
      version: 1,
      // Rehydrated after mount by CartHydrator, so the server HTML and first client render match.
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

export function selectCartCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}
