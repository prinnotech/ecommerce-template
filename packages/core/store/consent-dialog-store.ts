import { create } from "zustand";

// The cookie banner reopened from "Cookie settings" in the footer (the choice itself is a cookie).
export const useConsentDialog = create<{ is_open: boolean; open: () => void; close: () => void }>((set) => ({
  is_open: false,
  open: () => set({ is_open: true }),
  close: () => set({ is_open: false }),
}));
