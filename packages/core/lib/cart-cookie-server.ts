import "server-only";

import { cookies } from "next/headers";

import { CART_COOKIE } from "@repo/core/lib/cart-cookie";
import { cart_lines_schema } from "@repo/core/lib/schemas/checkout";
import type { CartLine } from "@repo/core/store/cart-store";

// Reads the cart cookie the client mirrors (see cart-cookie.ts). Invalid or absent → [].
export async function readCartCookieLines(): Promise<CartLine[]> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  if (!value) return [];
  try {
    const parsed = cart_lines_schema.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
