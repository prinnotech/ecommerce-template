"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { priceLines, type PricedCart } from "@/lib/checkout/checkout-server";
import { LOCALES } from "@/i18nConfig";
import { cart_lines_schema } from "@/lib/schemas/checkout";
import { reportError } from "@/lib/server-log";

const input_schema = z.object({ lines: cart_lines_schema, locale: z.enum(LOCALES) });

// Public: prices the browser's cart (ids + quantities) from the database for the cart page.
export async function getCartLines(input: { lines: unknown; locale: string }): Promise<ActionResult<PricedCart>> {
  const parsed = input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    return ok(await priceLines(parsed.data.lines, parsed.data.locale));
  } catch (error) {
    await reportError("cart", "getCartLines", error);
    return fail("generic");
  }
}
