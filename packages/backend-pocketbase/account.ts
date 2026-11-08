import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { AccountBackend, Address, CustomerOrderDetail } from "@repo/core/backend/types";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import { createServerPocketBase, setAuthCookie } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { OrdersResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

// Everything here runs with the visitor's own (user-scoped) client, so PocketBase's API
// rules apply on top of the checks in the actions.

const ADDRESS_FIELDS = "id,full_name,phone,line1,line2,city,region,postal_code,country,is_default";

function notFoundOn404(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

function toAddress(record: Record<string, unknown>): Address {
  return record as unknown as Address;
}

// Only one default address per customer.
async function clearOtherDefaults(pb: TypedPocketBase, user_id: string, keep_id: string) {
  const defaults = await pb.collection("addresses").getFullList({
    filter: pb.filter("user = {:user} && is_default = true && id != {:keep}", { user: user_id, keep: keep_id }),
    fields: "id",
  });
  await Promise.all(defaults.map((address) => pb.collection("addresses").update(address.id, { is_default: false })));
}

export const account: AccountBackend = {
  async updateProfile(user_id, profile) {
    const pb = await createServerPocketBase();
    await pb.collection("users").update(user_id, profile);
  },

  async changePassword(user, old_password, password) {
    const pb = await createServerPocketBase();
    try {
      await pb.collection("users").update(user.id, { oldPassword: old_password, password, passwordConfirm: password });
    } catch (error) {
      if (pocketBaseFieldCode(error, "oldPassword")) throw new BackendError("wrong_password");
      throw error;
    }
    try {
      // Changing the password revokes every token, so sign this browser back in.
      await pb.collection("users").authWithPassword(user.email, password);
      await setAuthCookie(pb.authStore.token);
    } catch {
      // The password did change; the customer just has to sign in again.
      throw new BackendError("not_signed_in");
    }
  },

  async listAddresses(user_id) {
    const pb = await createServerPocketBase();
    const addresses = await pb.collection("addresses").getFullList({
      filter: pb.filter("user = {:user}", { user: user_id }),
      sort: "-is_default,-created_at",
      fields: ADDRESS_FIELDS,
    });
    return addresses.map(toAddress);
  },

  async createAddress(user_id, address) {
    const pb = await createServerPocketBase();
    const existing = await pb
      .collection("addresses")
      .getList(1, 1, { filter: pb.filter("user = {:user}", { user: user_id }), fields: "id" });
    const is_default = address.is_default || existing.totalItems === 0;
    const created = await pb
      .collection("addresses")
      .create({ ...address, is_default, user: user_id }, { fields: ADDRESS_FIELDS });
    if (is_default) await clearOtherDefaults(pb, user_id, created.id);
    return toAddress(created);
  },

  async updateAddress(user_id, id, address) {
    const pb = await createServerPocketBase();
    const updated = await pb
      .collection("addresses")
      .update(id, address, { fields: ADDRESS_FIELDS })
      .catch(notFoundOn404);
    if (updated.is_default) await clearOtherDefaults(pb, user_id, updated.id);
    return toAddress(updated);
  },

  async setDefaultAddress(user_id, id) {
    const pb = await createServerPocketBase();
    await pb.collection("addresses").update(id, { is_default: true }).catch(notFoundOn404);
    await clearOtherDefaults(pb, user_id, id);
  },

  async deleteAddress(_user_id, id) {
    const pb = await createServerPocketBase();
    await pb.collection("addresses").delete(id).catch(notFoundOn404);
  },

  async listOrders(user_id, limit) {
    const pb = await createServerPocketBase();
    const orders = await pb.collection("orders").getList(1, limit, {
      filter: pb.filter('user = {:user} && deleted_at = ""', { user: user_id }),
      sort: "-created_at",
      fields: "id,order_number,status,payment_status,total,currency,created_at",
      skipTotal: true,
    });
    return orders.items;
  },

  async getOrder(user_id, id) {
    const pb = await createServerPocketBase();
    const order = await pb
      .collection("orders")
      .getOne<OrdersResponse<unknown, AddressFields | null, AddressFields | null>>(id, {
        fields:
          "id,order_number,status,payment_status,payment_method,currency,subtotal,shipping_total,tax_total," +
          "discount_total,cod_fee,total,gift_card_total,shipping_address,billing_address,shipping_method," +
          "customer_note,tracking_number,carrier,tracking_url,email,created_at,deleted_at,user",
      })
      .catch(notFoundOn404);
    if (order.deleted_at || order.user !== user_id) throw new BackendError("not_found");

    // order_events' API rules only return customer-visible events to the customer.
    const order_filter = pb.filter("order = {:order}", { order: id });
    const [items, events] = await Promise.all([
      pb.collection("order_items").getFullList({
        filter: order_filter,
        sort: "created_at",
        fields: "id,title,variant_label,sku,image,unit_price,quantity,line_total",
      }),
      pb.collection("order_events").getFullList({
        filter: order_filter,
        sort: "-created_at",
        fields: "id,type,to_status,message,created_at",
      }),
    ]);

    const { deleted_at: _deleted_at, user: _user, ...detail } = order;
    return { ...detail, items, events } satisfies CustomerOrderDetail;
  },
};
