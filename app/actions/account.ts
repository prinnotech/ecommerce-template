"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { pocketBaseFieldCode, pocketBaseStatus } from "@/lib/pocketbase/errors";
import { createServerPocketBase, setAuthCookie } from "@/lib/pocketbase/pocketbase-server";
import {
  address_schema,
  change_password_schema,
  profile_schema,
  record_id_schema,
  update_address_schema,
  type AddressFields,
  type AddressInput,
  type ChangePasswordInput,
  type ProfileInput,
  type UpdateAddressInput,
} from "@/lib/schemas/account";
import { reportError } from "@/lib/server-log";
import type {
  AddressesResponse,
  OrderEventsResponse,
  OrderItemsResponse,
  OrdersResponse,
} from "@/types/pocketbase-types";

// Every action here acts on the signed-in customer's own data, through the user-scoped
// client, so PocketBase's API rules apply on top of the checks below.

export type Address = Pick<
  AddressesResponse,
  "id" | "full_name" | "phone" | "line1" | "line2" | "city" | "region" | "postal_code" | "country" | "is_default"
>;

const ADDRESS_FIELDS = "id,full_name,phone,line1,line2,city,region,postal_code,country,is_default";

export type OrderSummary = Pick<
  OrdersResponse,
  "id" | "order_number" | "status" | "payment_status" | "total" | "currency" | "created_at"
>;

const ORDER_SUMMARY_FIELDS = "id,order_number,status,payment_status,total,currency,created_at";

export type OrderDetail = Pick<
  OrdersResponse<unknown, AddressFields | null, AddressFields | null>,
  | "id"
  | "order_number"
  | "status"
  | "payment_status"
  | "payment_method"
  | "currency"
  | "subtotal"
  | "shipping_total"
  | "tax_total"
  | "discount_total"
  | "cod_fee"
  | "total"
  | "shipping_address"
  | "billing_address"
  | "shipping_method"
  | "customer_note"
  | "tracking_number"
  | "carrier"
  | "tracking_url"
  | "email"
  | "created_at"
> & {
  items: Pick<
    OrderItemsResponse,
    "id" | "title" | "variant_label" | "sku" | "image" | "unit_price" | "quantity" | "line_total"
  >[];
  events: Pick<OrderEventsResponse, "id" | "type" | "to_status" | "message" | "created_at">[];
};

export type Profile = { name: string; email: string; phone: string };

async function signedInClient() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, pb: await createServerPocketBase() };
}

// ---------- Profile ----------

export async function getMyProfile(): Promise<ActionResult<Profile>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  return ok({ name: user.name, email: user.email, phone: user.phone });
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult<null>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  const parsed = profile_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await session.pb.collection("users").update(session.user.id, parsed.data);
    return ok(null);
  } catch (error) {
    await reportError("account", "updateProfile", error);
    return fail("generic");
  }
}

export async function changePassword(input: ChangePasswordInput): Promise<ActionResult<null>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  const parsed = change_password_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { old_password, password } = parsed.data;

  try {
    await session.pb.collection("users").update(session.user.id, {
      oldPassword: old_password,
      password,
      passwordConfirm: password,
    });
  } catch (error) {
    if (pocketBaseFieldCode(error, "oldPassword")) return fail("wrong_password");
    await reportError("account", "changePassword", error);
    return fail("generic");
  }

  try {
    // Changing the password revokes every token, so sign this browser back in.
    await session.pb.collection("users").authWithPassword(session.user.email, password);
    await setAuthCookie(session.pb.authStore.token);
    return ok(null);
  } catch (error) {
    await reportError("account", "changePassword re-auth", error);
    return fail("not_signed_in");
  }
}

// ---------- Addresses ----------

export async function getMyAddresses(): Promise<ActionResult<Address[]>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");

  try {
    const addresses = await session.pb.collection("addresses").getFullList({
      filter: session.pb.filter("user = {:user}", { user: session.user.id }),
      sort: "-is_default,-created_at",
      fields: ADDRESS_FIELDS,
    });
    return ok(addresses);
  } catch (error) {
    await reportError("account", "getMyAddresses", error);
    return fail("generic");
  }
}

// Only one default address per customer.
async function clearOtherDefaults(session: NonNullable<Awaited<ReturnType<typeof signedInClient>>>, keep_id: string) {
  const defaults = await session.pb.collection("addresses").getFullList({
    filter: session.pb.filter("user = {:user} && is_default = true && id != {:keep}", {
      user: session.user.id,
      keep: keep_id,
    }),
    fields: "id",
  });
  await Promise.all(
    defaults.map((address) => session.pb.collection("addresses").update(address.id, { is_default: false })),
  );
}

export async function createAddress(input: AddressInput): Promise<ActionResult<Address>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  const parsed = address_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const existing = await session.pb.collection("addresses").getList(1, 1, {
      filter: session.pb.filter("user = {:user}", { user: session.user.id }),
      fields: "id",
    });
    // The first address is always the default.
    const is_default = parsed.data.is_default || existing.totalItems === 0;
    const address = await session.pb
      .collection("addresses")
      .create({ ...parsed.data, is_default, user: session.user.id }, { fields: ADDRESS_FIELDS });
    if (is_default) await clearOtherDefaults(session, address.id);
    return ok(address);
  } catch (error) {
    await reportError("account", "createAddress", error);
    return fail("generic");
  }
}

export async function updateAddress(input: UpdateAddressInput): Promise<ActionResult<Address>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  const parsed = update_address_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, ...fields } = parsed.data;

  try {
    const address = await session.pb.collection("addresses").update(id, fields, { fields: ADDRESS_FIELDS });
    if (address.is_default) await clearOtherDefaults(session, address.id);
    return ok(address);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("account", "updateAddress", error);
    return fail("generic");
  }
}

export async function setDefaultAddress(id: string): Promise<ActionResult<null>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await session.pb.collection("addresses").update(id, { is_default: true });
    await clearOtherDefaults(session, id);
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("account", "setDefaultAddress", error);
    return fail("generic");
  }
}

export async function deleteAddress(id: string): Promise<ActionResult<null>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await session.pb.collection("addresses").delete(id);
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("account", "deleteAddress", error);
    return fail("generic");
  }
}

// ---------- Orders (read-only for customers) ----------

export async function getMyOrders(limit = 50): Promise<ActionResult<OrderSummary[]>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");

  try {
    const orders = await session.pb.collection("orders").getList(1, Math.min(Math.max(limit, 1), 200), {
      filter: session.pb.filter('user = {:user} && deleted_at = ""', { user: session.user.id }),
      sort: "-created_at",
      fields: ORDER_SUMMARY_FIELDS,
      skipTotal: true,
    });
    return ok(orders.items);
  } catch (error) {
    await reportError("account", "getMyOrders", error);
    return fail("generic");
  }
}

export async function getMyOrder(id: string): Promise<ActionResult<OrderDetail>> {
  const session = await signedInClient();
  if (!session) return fail("not_signed_in");
  if (!record_id_schema.safeParse(id).success) return fail("not_found");

  try {
    const order = await session.pb
      .collection("orders")
      .getOne<OrdersResponse<unknown, AddressFields | null, AddressFields | null>>(id, {
        fields:
          "id,order_number,status,payment_status,payment_method,currency,subtotal,shipping_total,tax_total," +
          "discount_total,cod_fee,total,shipping_address,billing_address,shipping_method,customer_note," +
          "tracking_number,carrier,tracking_url,email,created_at,deleted_at,user",
      });
    if (order.deleted_at || order.user !== session.user.id) return fail("not_found");

    const order_filter = session.pb.filter("order = {:order}", { order: id });
    const [items, events] = await Promise.all([
      session.pb.collection("order_items").getFullList({
        filter: order_filter,
        sort: "created_at",
        fields: "id,title,variant_label,sku,image,unit_price,quantity,line_total",
      }),
      session.pb.collection("order_events").getFullList({
        filter: order_filter,
        sort: "-created_at",
        fields: "id,type,to_status,message,created_at",
      }),
    ]);

    const { deleted_at: _deleted_at, user: _user, ...detail } = order;
    return ok({ ...detail, items, events });
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("account", "getMyOrder", error);
    return fail("generic");
  }
}
