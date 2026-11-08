import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { Address, CustomersBackend } from "@repo/core/backend/types";
import type { OrderStatus } from "@repo/core/lib/orders";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { SqlContext } from "@repo/backend-sql/context";
import { ORDER_ROW_COLUMNS, rowsQuery, toOrderRows } from "@repo/backend-sql/orders";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

export const ADDRESS_COLUMNS = [
  "id",
  "full_name",
  "phone",
  "line1",
  "line2",
  "city",
  "region",
  "postal_code",
  "country",
  "is_default",
] as const;

export function toAddress(row: Record<(typeof ADDRESS_COLUMNS)[number], unknown>): Address {
  return {
    id: String(row.id),
    full_name: String(row.full_name),
    phone: String(row.phone),
    line1: String(row.line1),
    line2: String(row.line2),
    city: String(row.city),
    region: String(row.region),
    postal_code: String(row.postal_code),
    country: String(row.country) as AddressFields["country"],
    is_default: bool(row.is_default),
  };
}

export function createCustomers({ db }: SqlContext): CustomersBackend {
  return {
    async users() {
      const rows = await db
        .selectFrom("users")
        .select(["id", "email", "name", "phone", "created_at", "verified", "accepts_marketing"])
        .execute();
      return rows.map((row) => ({
        ...row,
        created_at: iso(row.created_at),
        verified: bool(row.verified),
        accepts_marketing: bool(row.accepts_marketing),
      }));
    },

    async orderRecords() {
      const rows = await rowsQuery(db)
        .select([
          "orders.id",
          "orders.user_id",
          "orders.email",
          "orders.total",
          "orders.currency",
          "orders.status",
          "orders.created_at",
          "orders.shipping_address",
        ])
        .orderBy("orders.created_at")
        .execute();
      return rows.map((row) => ({
        id: row.id,
        user: row.user_id ?? "",
        email: row.email,
        total: row.total,
        currency: row.currency,
        status: row.status as OrderStatus,
        created_at: iso(row.created_at),
        shipping_address: json<AddressFields | null>(row.shipping_address, null),
      }));
    },

    async ordersOf({ user_id, email }) {
      let query = rowsQuery(db);
      query = user_id
        ? query.where((eb) =>
            eb.or([
              eb("orders.user_id", "=", user_id),
              eb.and([eb("orders.user_id", "is", null), eb("orders.email", "=", email)]),
            ]),
          )
        : query.where("orders.user_id", "is", null).where("orders.email", "=", email);
      return toOrderRows(
        db,
        await query
          .select([...ORDER_ROW_COLUMNS])
          .orderBy("orders.created_at", "desc")
          .execute(),
      );
    },

    async savedAddresses(user_id) {
      const rows = await db
        .selectFrom("addresses")
        .select([...ADDRESS_COLUMNS])
        .where("user_id", "=", user_id)
        .orderBy("is_default", "desc")
        .orderBy("updated_at", "desc")
        .execute();
      return rows.map(toAddress);
    },

    async getNote(customer_key) {
      const row = await db
        .selectFrom("customer_notes")
        .select("note")
        .where("customer_key", "=", customer_key)
        .executeTakeFirst();
      return row?.note ?? "";
    },

    async setNote(customer_key, note, actor) {
      await db
        .insertInto("customer_notes")
        .values({ id: newId(), customer_key, note, updated_by: actor })
        .onConflict((conflict) =>
          conflict.column("customer_key").doUpdateSet({ note, updated_by: actor, updated_at: nowIso() }),
        )
        .execute();
    },

    async setAcceptsMarketing(user_id, accepts_marketing) {
      const result = await db
        .updateTable("users")
        .set({ accepts_marketing, updated_at: nowIso() })
        .where("id", "=", user_id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },
  };
}
