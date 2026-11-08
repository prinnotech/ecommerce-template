import type { CartLine } from "@repo/core/store/cart-store";

export const CART_COOKIE = "cart";

const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Client only: mirrors the cart to a cookie so the cart page can be rendered on the
// server first (audit X8). Called from CartHydrator after hydration and on every change.
export function writeCartCookie(lines: CartLine[]): void {
  if (lines.length === 0) {
    document.cookie = `${CART_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(lines));
  document.cookie = `${CART_COOKIE}=${value}; path=/; max-age=${CART_COOKIE_MAX_AGE}; samesite=lax`;
}
