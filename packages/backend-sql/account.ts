import "server-only";

import type { Kysely } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { AccountBackend, CustomerOrderDetail, SessionUser } from "@repo/core/backend/types";
import type { OrderEventType, OrderStatus, PaymentMethod, PaymentStatus } from "@repo/core/lib/orders";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { SqlContext } from "@repo/backend-sql/context";
import { ADDRESS_COLUMNS, toAddress } from "@repo/backend-sql/customers";
import type { Database } from "@repo/backend-sql/schema";
import { iso, json, newId, nowIso } from "@repo/backend-sql/values";

// The auth provider's part of the account: changing the password, and keeping its own copy of
// the profile (Supabase user metadata) in sync.
export type AccountAuth = {
  changePassword(user: SessionUser, old_password: string, password: string): Promise<void>; // wrong_password
  profileChanged?(user_id: string, profile: { name: string; phone: string }): Promise<void>;
};

// Only one default address per customer.
async function clearOtherDefaults(db: Kysely<Database>, user_id: string, keep_id: string) {
  await db
    .updateTable("addresses")
    .set({ is_default: false, updated_at: nowIso() })
    .where("user_id", "=", user_id)
    .where("id", "!=", keep_id)
    .where("is_default", "=", true)
    .execute();
}

export function createAccount({ db }: SqlContext, auth: AccountAuth): AccountBackend {
  async function ownAddress(user_id: string, id: string) {
    const row = await db
      .selectFrom("addresses")
      .select([...ADDRESS_COLUMNS])
      .where("id", "=", id)
      .where("user_id", "=", user_id)
      .executeTakeFirst();
    if (!row) throw new BackendError("not_found");
    return row;
  }

  return {
    async updateProfile(user_id, profile) {
      await db
        .updateTable("users")
        .set({ ...profile, updated_at: nowIso() })
        .where("id", "=", user_id)
        .execute();
      await auth.profileChanged?.(user_id, profile);
    },

    changePassword: (user, old_password, password) => auth.changePassword(user, old_password, password),

    async listAddresses(user_id) {
      const rows = await db
        .selectFrom("addresses")
        .select([...ADDRESS_COLUMNS])
        .where("user_id", "=", user_id)
        .orderBy("is_default", "desc")
        .orderBy("created_at", "desc")
        .execute();
      return rows.map(toAddress);
    },

    async createAddress(user_id, address) {
      const existing = await db
        .selectFrom("addresses")
        .select("id")
        .where("user_id", "=", user_id)
        .limit(1)
        .executeTakeFirst();
      const is_default = address.is_default || !existing;
      const id = newId();
      await db
        .insertInto("addresses")
        .values({ id, user_id, ...address, is_default })
        .execute();
      if (is_default) await clearOtherDefaults(db, user_id, id);
      return toAddress(await ownAddress(user_id, id));
    },

    async updateAddress(user_id, id, address) {
      await ownAddress(user_id, id);
      await db
        .updateTable("addresses")
        .set({ ...address, updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
      if (address.is_default) await clearOtherDefaults(db, user_id, id);
      return toAddress(await ownAddress(user_id, id));
    },

    async setDefaultAddress(user_id, id) {
      await ownAddress(user_id, id);
      await db.updateTable("addresses").set({ is_default: true, updated_at: nowIso() }).where("id", "=", id).execute();
      await clearOtherDefaults(db, user_id, id);
    },

    async deleteAddress(user_id, id) {
      await ownAddress(user_id, id);
      await db.deleteFrom("addresses").where("id", "=", id).execute();
    },

    async listOrders(user_id, limit) {
      const rows = await db
        .selectFrom("orders")
        .select(["id", "order_number", "status", "payment_status", "total", "currency", "created_at"])
        .where("user_id", "=", user_id)
        .where("deleted_at", "is", null)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute();
      return rows.map((row) => ({
        ...row,
        status: row.status as OrderStatus,
        payment_status: row.payment_status as PaymentStatus,
        created_at: iso(row.created_at),
      }));
    },

    async getOrder(user_id, id) {
      const order = await db.selectFrom("orders").selectAll().where("id", "=", id).executeTakeFirst();
      if (!order || order.deleted_at || order.user_id !== user_id) throw new BackendError("not_found");
      const [items, events] = await Promise.all([
        db
          .selectFrom("order_items")
          .select(["id", "title", "variant_label", "sku", "image", "unit_price", "quantity", "line_total"])
          .where("order_id", "=", id)
          .orderBy("created_at")
          .execute(),
        // Customers only ever see the events marked visible to them.
        db
          .selectFrom("order_events")
          .select(["id", "type", "to_status", "message", "created_at"])
          .where("order_id", "=", id)
          .where("is_customer_visible", "=", true)
          .orderBy("created_at", "desc")
          .execute(),
      ]);
      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status as OrderStatus,
        payment_status: order.payment_status as PaymentStatus,
        payment_method: order.payment_method as PaymentMethod | "",
        currency: order.currency,
        subtotal: order.subtotal,
        shipping_total: order.shipping_total,
        tax_total: order.tax_total,
        discount_total: order.discount_total,
        cod_fee: order.cod_fee,
        total: order.total,
        gift_card_total: order.gift_card_total,
        shipping_address: json<AddressFields | null>(order.shipping_address, null),
        billing_address: json<AddressFields | null>(order.billing_address, null),
        shipping_method: order.shipping_method,
        customer_note: order.customer_note,
        tracking_number: order.tracking_number,
        carrier: order.carrier,
        tracking_url: order.tracking_url,
        email: order.email,
        created_at: iso(order.created_at),
        items,
        events: events.map((event) => ({
          ...event,
          type: event.type as OrderEventType,
          created_at: iso(event.created_at),
        })),
      } satisfies CustomerOrderDetail;
    },
  };
}
