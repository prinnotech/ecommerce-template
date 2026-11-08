"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { Address, CustomerOrderDetail, CustomerOrderSummary } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { getCaller, getCurrentUser } from "@repo/core/lib/auth";
import {
  address_schema,
  change_password_schema,
  profile_schema,
  record_id_schema,
  update_address_schema,
  type AddressInput,
  type ChangePasswordInput,
  type ProfileInput,
  type UpdateAddressInput,
} from "@repo/core/lib/schemas/account";

// Every action here acts on the signed-in customer's own data: the user id always comes
// from the verified session, never from the input.

export type { Address };
export type OrderSummary = CustomerOrderSummary;
export type OrderDetail = CustomerOrderDetail;
export type Profile = { name: string; email: string; phone: string };

// ---------- Profile ----------

export async function getMyProfile(): Promise<ActionResult<Profile>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  return ok({ name: user.name, email: user.email, phone: user.phone });
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  if ((await getCaller())?.is_read_only) return fail("demo_read_only");
  const parsed = profile_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await getBackend().account.updateProfile(user.id, parsed.data);
    return ok(null);
  } catch (error) {
    return failFrom(error, "account", "updateProfile");
  }
}

export async function changePassword(input: ChangePasswordInput): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  if ((await getCaller())?.is_read_only) return fail("demo_read_only");
  const parsed = change_password_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await getBackend().account.changePassword(user, parsed.data.old_password, parsed.data.password);
    return ok(null);
  } catch (error) {
    return failFrom(error, "account", "changePassword");
  }
}

// ---------- Addresses ----------

export async function getMyAddresses(): Promise<ActionResult<Address[]>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");

  try {
    return ok(await getBackend().account.listAddresses(user.id));
  } catch (error) {
    return failFrom(error, "account", "getMyAddresses");
  }
}

export async function createAddress(input: AddressInput): Promise<ActionResult<Address>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  const parsed = address_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    return ok(await getBackend().account.createAddress(user.id, parsed.data));
  } catch (error) {
    return failFrom(error, "account", "createAddress");
  }
}

export async function updateAddress(input: UpdateAddressInput): Promise<ActionResult<Address>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  const parsed = update_address_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, ...address } = parsed.data;

  try {
    return ok(await getBackend().account.updateAddress(user.id, id, address));
  } catch (error) {
    return failFrom(error, "account", "updateAddress");
  }
}

export async function setDefaultAddress(id: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await getBackend().account.setDefaultAddress(user.id, id);
    return ok(null);
  } catch (error) {
    return failFrom(error, "account", "setDefaultAddress");
  }
}

export async function deleteAddress(id: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await getBackend().account.deleteAddress(user.id, id);
    return ok(null);
  } catch (error) {
    return failFrom(error, "account", "deleteAddress");
  }
}

// ---------- Orders (read-only for customers) ----------

export async function getMyOrders(limit = 50): Promise<ActionResult<OrderSummary[]>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");

  try {
    return ok(await getBackend().account.listOrders(user.id, Math.min(Math.max(limit, 1), 200)));
  } catch (error) {
    return failFrom(error, "account", "getMyOrders");
  }
}

export async function getMyOrder(id: string): Promise<ActionResult<OrderDetail>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  if (!record_id_schema.safeParse(id).success) return fail("not_found");

  try {
    return ok(await getBackend().account.getOrder(user.id, id));
  } catch (error) {
    return failFrom(error, "account", "getMyOrder");
  }
}
