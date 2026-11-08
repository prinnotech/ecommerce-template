"use server";

import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { StoreProductCard } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { getCurrentUser } from "@repo/core/lib/auth";
import { id_schema } from "@repo/core/lib/schemas/ids";

// The signed-in customer's wishlist. Guests keep theirs in the browser (store/wishlist-store.ts)
// and it moves here when they sign in (addToWishlist with every saved id).

const ids_schema = z.array(id_schema).min(1).max(200);

export async function getMyWishlistIds(): Promise<ActionResult<string[] | null>> {
  const user = await getCurrentUser();
  if (!user) return ok(null);
  try {
    return ok(await getBackend().wishlist.list(user.id));
  } catch (error) {
    return failFrom(error, "wishlist", "getMyWishlistIds");
  }
}

export async function addToWishlist(input: { product_ids: string[] }): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  const parsed = ids_schema.safeParse(input.product_ids);
  if (!parsed.success) return fail("invalid_input");
  try {
    await getBackend().wishlist.add(user.id, parsed.data);
    return ok(null);
  } catch (error) {
    return failFrom(error, "wishlist", "addToWishlist");
  }
}

export async function removeFromWishlist(input: { product_id: string }): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  if (!id_schema.safeParse(input.product_id).success) return fail("invalid_input");
  try {
    await getBackend().wishlist.remove(user.id, input.product_id);
    return ok(null);
  } catch (error) {
    return failFrom(error, "wishlist", "removeFromWishlist");
  }
}

// Cards for a list of ids (the account page, or a guest's saved ids). Hidden products drop out.
export async function getWishlistProducts(input: { product_ids: string[] }): Promise<ActionResult<StoreProductCard[]>> {
  const parsed = z.array(id_schema).max(200).safeParse(input.product_ids);
  if (!parsed.success) return fail("invalid_input");
  try {
    return ok(await getBackend().storefront.productCardsByIds(parsed.data));
  } catch (error) {
    return failFrom(error, "wishlist", "getWishlistProducts");
  }
}
