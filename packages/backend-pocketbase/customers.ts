import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { Address, CustomersBackend } from "@repo/core/backend/types";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import { ORDER_ROW_FIELDS, toOrderRows, type OrderRecord } from "@repo/backend-pocketbase/orders";

export const customers: CustomersBackend = {
  async users() {
    const pb = await createAdminPocketBase();
    const users = await pb
      .collection("users")
      .getFullList({ fields: "id,email,name,phone,created_at,verified,accepts_marketing" });
    return users.map((user) => ({ ...user, accepts_marketing: user.accepts_marketing ?? false }));
  },

  async orderRecords() {
    const pb = await createAdminPocketBase();
    const orders = await pb.collection("orders").getFullList<OrderRecord>({
      filter: 'deleted_at = ""',
      sort: "created_at",
      fields: "id,user,email,total,currency,status,created_at,shipping_address",
    });
    return orders.map((order) => ({
      id: order.id,
      user: order.user,
      email: order.email,
      total: order.total,
      currency: order.currency,
      status: order.status,
      created_at: order.created_at,
      shipping_address: (order.shipping_address as AddressFields | null) ?? null,
    }));
  },

  async ordersOf({ user_id, email }) {
    const pb = await createAdminPocketBase();
    const filter = user_id
      ? pb.filter('deleted_at = "" && (user = {:id} || (user = "" && email = {:email}))', { id: user_id, email })
      : pb.filter('deleted_at = "" && user = "" && email = {:email}', { email });
    const orders = await pb.collection("orders").getFullList<OrderRecord>({
      filter,
      sort: "-created_at",
      fields: ORDER_ROW_FIELDS,
    });
    return toOrderRows(pb, orders);
  },

  async savedAddresses(user_id) {
    const pb = await createAdminPocketBase();
    const addresses = await pb.collection("addresses").getFullList({
      filter: pb.filter("user = {:id}", { id: user_id }),
      sort: "-is_default,-updated_at",
      fields: "id,full_name,phone,line1,line2,city,region,postal_code,country,is_default",
    });
    return addresses as unknown as Address[];
  },

  async getNote(customer_key) {
    const pb = await createAdminPocketBase();
    const row = await pb
      .collection("customer_notes")
      .getFirstListItem(pb.filter("customer_key = {:key}", { key: customer_key }), { fields: "note" })
      .catch(() => null);
    return row?.note ?? "";
  },

  async setNote(customer_key, note, actor) {
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("customer_notes")
      .getFirstListItem(pb.filter("customer_key = {:key}", { key: customer_key }), { fields: "id" })
      .catch(() => null);
    if (existing) await pb.collection("customer_notes").update(existing.id, { note, updated_by: actor });
    else await pb.collection("customer_notes").create({ customer_key, note, updated_by: actor });
  },

  async setAcceptsMarketing(user_id, accepts_marketing) {
    const pb = await createAdminPocketBase();
    try {
      await pb.collection("users").update(user_id, { accepts_marketing });
    } catch (error) {
      if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
      throw error;
    }
  },
};
