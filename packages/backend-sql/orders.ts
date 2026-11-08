import "server-only";

import type { Kysely, SelectQueryBuilder } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminOrderRow, OrderState, OrdersBackend } from "@repo/core/backend/types";
import {
  ARCHIVED_STATUSES,
  OPEN_STATUSES,
  type OrderEventType,
  type OrderStatus,
  type PaymentMethod,
  type PaymentRecordStatus,
  type PaymentStatus,
} from "@repo/core/lib/orders";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { OrderListFilters } from "@repo/core/lib/schemas/orders";
import { changeStockLogged } from "@repo/backend-sql/inventory";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import type { Database } from "@repo/backend-sql/schema";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";
import { parseAttribution } from "@repo/core/lib/tracking/attribution";

// Admin order work. Callers are authorized and the lifecycle rules (lib/orders.ts) checked
// in the actions first; every change here is one transaction with its timeline event.

const ROW_COLUMNS = [
  "orders.id",
  "orders.order_number",
  "orders.created_at",
  "orders.shipping_address",
  "orders.email",
  "orders.status",
  "orders.payment_status",
  "orders.payment_method",
  "orders.total",
  "orders.currency",
] as const;

type OrderRowRecord = {
  id: string;
  order_number: number;
  created_at: string;
  shipping_address: unknown;
  email: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  currency: string;
};

export function rowsQuery(db: Kysely<Database>): SelectQueryBuilder<Database, "orders", object> {
  return db.selectFrom("orders").where("orders.deleted_at", "is", null);
}

export const ORDER_ROW_COLUMNS = ROW_COLUMNS;

export async function toOrderRows(db: Kysely<Database>, orders: OrderRowRecord[]): Promise<AdminOrderRow[]> {
  const ids = orders.map((order) => order.id);
  const counts =
    ids.length > 0
      ? await db
          .selectFrom("order_items")
          .select(["order_id", (eb) => eb.fn.sum("quantity").as("count")])
          .where("order_id", "in", ids)
          .groupBy("order_id")
          .execute()
      : [];
  const by_order = new Map(counts.map((row) => [row.order_id, Number(row.count)]));
  return orders.map((order) => {
    const address = json<AddressFields | null>(order.shipping_address, null);
    return {
      id: order.id,
      order_number: order.order_number,
      created_at: iso(order.created_at),
      customer_name: address?.full_name || order.email,
      email: order.email,
      status: order.status as OrderStatus,
      payment_status: order.payment_status as PaymentStatus,
      payment_method: order.payment_method,
      total: order.total,
      currency: order.currency,
      item_count: by_order.get(order.id) ?? 0,
    };
  });
}

// Puts an order's items back in stock (variants that no longer exist are skipped by the update).
async function restock(trx: Kysely<Database>, order: { id: string; order_number: number }, actor_id: string) {
  const items = await trx
    .selectFrom("order_items")
    .select(["variant_id", "quantity"])
    .where("order_id", "=", order.id)
    .execute();
  for (const item of items) {
    if (!item.variant_id) continue;
    await changeStockLogged(trx, item.variant_id, item.quantity, {
      reason: "restock",
      note: `#${order.order_number}`,
      actor_id,
    });
  }
}

async function addEvent(
  trx: Kysely<Database>,
  order_id: string,
  event: {
    type: OrderEventType;
    from_status?: string;
    to_status?: string;
    message?: string;
    actor: string;
    is_customer_visible: boolean;
  },
) {
  const { actor, ...fields } = event;
  await trx
    .insertInto("order_events")
    .values({ id: newId(), order_id, ...fields, actor_id: actor || null })
    .execute();
}

export function createOrders(ctx: SqlContext): OrdersBackend {
  const { db } = ctx;
  return {
    async list(filters: OrderListFilters, page_size) {
      let query = rowsQuery(db);
      if (filters.status === "open") query = query.where("orders.status", "in", [...OPEN_STATUSES]);
      else if (filters.status === "archived") query = query.where("orders.status", "in", [...ARCHIVED_STATUSES]);
      else if (filters.status !== "all") query = query.where("orders.status", "=", filters.status);
      if (filters.payment !== "all") query = query.where("orders.payment_status", "=", filters.payment);
      if (filters.search) {
        const search = filters.search;
        const number = Number(search.replace(/^#/, ""));
        query =
          Number.isInteger(number) && number > 0
            ? query.where("orders.order_number", "=", number)
            : query.where((eb) =>
                eb.or([
                  contains(ctx, "orders.email", search),
                  contains(ctx, "orders.shipping_address", search),
                  contains(ctx, "orders.phone", search),
                ]),
              );
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          toOrderRows(
            db,
            await query
              .select([...ROW_COLUMNS])
              .orderBy(`orders.${filters.sort}`, filters.direction)
              .orderBy("orders.id")
              .offset(offset)
              .limit(limit)
              .execute(),
          ),
      );
    },

    async getIdByNumber(order_number) {
      const row = await db
        .selectFrom("orders")
        .select(["id"])
        .where("order_number", "=", order_number)
        .executeTakeFirst();
      return row ? String(row.id) : null;
    },

    async get(id) {
      const order = await db.selectFrom("orders").selectAll().where("id", "=", id).executeTakeFirst();
      if (!order || order.deleted_at) throw new BackendError("not_found");

      const [items, events, payments, customer_orders, user, discount, refunds] = await Promise.all([
        db.selectFrom("order_items").selectAll().where("order_id", "=", id).orderBy("created_at").execute(),
        db
          .selectFrom("order_events")
          .leftJoin("users", "users.id", "order_events.actor_id")
          .select([
            "order_events.id",
            "order_events.type",
            "order_events.from_status",
            "order_events.to_status",
            "order_events.message",
            "order_events.is_customer_visible",
            "order_events.created_at",
            "users.name as actor_name",
            "users.email as actor_email",
          ])
          .where("order_events.order_id", "=", id)
          .orderBy("order_events.created_at", "desc")
          .execute(),
        db
          .selectFrom("payments")
          .selectAll()
          .where((eb) =>
            order.checkout_session_id
              ? eb.or([eb("order_id", "=", id), eb("checkout_session_id", "=", order.checkout_session_id)])
              : eb("order_id", "=", id),
          )
          .orderBy("created_at", "desc")
          .execute(),
        order.user_id
          ? db
              .selectFrom("orders")
              .select((eb) => eb.fn.countAll().as("count"))
              .where("user_id", "=", order.user_id)
              .executeTakeFirst()
          : undefined,
        order.user_id
          ? db.selectFrom("users").select(["id", "name"]).where("id", "=", order.user_id).executeTakeFirst()
          : undefined,
        order.discount_code_id
          ? db.selectFrom("discount_codes").select("code").where("id", "=", order.discount_code_id).executeTakeFirst()
          : undefined,
        db
          .selectFrom("refunds")
          .leftJoin("users", "users.id", "refunds.actor_id")
          .select([
            "refunds.id",
            "refunds.created_at",
            "refunds.amount",
            "refunds.reason",
            "refunds.lines",
            "refunds.restocked",
            "users.name as actor_name",
            "users.email as actor_email",
          ])
          .where("refunds.order_id", "=", id)
          .orderBy("refunds.created_at", "desc")
          .execute(),
      ]);

      return {
        id: order.id,
        order_number: order.order_number,
        created_at: iso(order.created_at),
        status: order.status as OrderStatus,
        payment_status: order.payment_status as PaymentStatus,
        payment_method: order.payment_method as PaymentMethod | "",
        currency: order.currency,
        subtotal: order.subtotal,
        discount_total: order.discount_total,
        shipping_total: order.shipping_total,
        tax_total: order.tax_total,
        cod_fee: order.cod_fee,
        total: order.total,
        email: order.email,
        phone: order.phone,
        locale: order.locale,
        shipping_address: json<AddressFields | null>(order.shipping_address, null),
        billing_address: json<AddressFields | null>(order.billing_address, null),
        shipping_method: order.shipping_method,
        customer_note: order.customer_note,
        internal_note: order.internal_note,
        attribution: order.attribution ? parseAttribution(json(order.attribution, null)) : null,
        refunded_total: order.refunded_total,
        gift_card_total: order.gift_card_total,
        checkout_session_id: order.checkout_session_id ?? "",
        refunds: refunds.map((refund) => ({
          id: refund.id,
          created_at: iso(refund.created_at),
          amount: refund.amount,
          reason: refund.reason,
          lines: json<{ item_id: string; quantity: number }[]>(refund.lines, []),
          restocked: bool(refund.restocked),
          actor_name: refund.actor_name || refund.actor_email || "",
        })),
        tracking_number: order.tracking_number,
        carrier: order.carrier,
        tracking_url: order.tracking_url,
        paid_at: iso(order.paid_at),
        shipped_at: iso(order.shipped_at),
        delivered_at: iso(order.delivered_at),
        cancelled_at: iso(order.cancelled_at),
        items: items.map((item) => ({
          id: item.id,
          product: item.product_id ?? "",
          variant: item.variant_id ?? "",
          title: item.title,
          variant_label: item.variant_label,
          sku: item.sku,
          image: item.image,
          unit_price: item.unit_price,
          quantity: item.quantity,
          line_total: item.line_total,
        })),
        events: events.map((event) => ({
          id: event.id,
          type: event.type as OrderEventType,
          from_status: event.from_status,
          to_status: event.to_status,
          message: event.message,
          is_customer_visible: bool(event.is_customer_visible),
          created_at: iso(event.created_at),
          actor_name: event.actor_name || event.actor_email || "",
        })),
        payments: payments.map((payment) => ({
          id: payment.id,
          provider: payment.provider,
          provider_ref: payment.provider_ref,
          status: payment.status as PaymentRecordStatus,
          amount: payment.amount,
          error_code: payment.error_code,
          created_at: iso(payment.created_at),
        })),
        customer: order.user_id
          ? { user_id: order.user_id, name: user?.name ?? "", order_count: Number(customer_orders?.count ?? 1) }
          : null,
        discount_code: discount?.code ?? "",
      };
    },

    async getState(id) {
      const order = await db
        .selectFrom("orders")
        .select([
          "id",
          "order_number",
          "status",
          "payment_status",
          "payment_method",
          "total",
          "currency",
          "refunded_total",
          "deleted_at",
        ])
        .where("id", "=", id)
        .executeTakeFirst();
      if (!order || order.deleted_at) return null;
      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status as OrderStatus,
        payment_status: order.payment_status as PaymentStatus,
        payment_method: order.payment_method as PaymentMethod | "",
        total: order.total,
        currency: order.currency,
        refunded_total: order.refunded_total,
      } satisfies OrderState;
    },

    async changeStatus(order, to, { actor, timestamp_field, restock: is_restock }) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("orders")
          .set({ status: to, ...(timestamp_field ? { [timestamp_field]: nowIso() } : {}), updated_at: nowIso() })
          .where("id", "=", order.id)
          .execute();
        await addEvent(trx, order.id, {
          type: "status_changed",
          from_status: order.status,
          to_status: to,
          actor,
          is_customer_visible: true,
        });
        if (is_restock) await restock(trx, order, actor);
      });
    },

    async markPaid(order, actor) {
      await db.transaction().execute(async (trx) => {
        const pending = await trx
          .selectFrom("payments")
          .select("id")
          .where("order_id", "=", order.id)
          .where("status", "=", "pending")
          .executeTakeFirst();
        await trx
          .updateTable("orders")
          .set({ payment_status: "paid", paid_at: nowIso(), updated_at: nowIso() })
          .where("id", "=", order.id)
          .execute();
        if (pending)
          await trx
            .updateTable("payments")
            .set({ status: "succeeded", updated_at: nowIso() })
            .where("id", "=", pending.id)
            .execute();
        else {
          await trx
            .insertInto("payments")
            .values({
              id: newId(),
              order_id: order.id,
              provider: order.payment_method || "cash_on_delivery",
              amount: order.total,
              currency: order.currency,
              status: "succeeded",
            })
            .execute();
        }
        await addEvent(trx, order.id, {
          type: "payment_status_changed",
          from_status: order.payment_status,
          to_status: "paid",
          actor,
          is_customer_visible: true,
        });
      });
    },

    async refund(order, refund) {
      return db.transaction().execute(async (trx) => {
        const current = await trx
          .selectFrom("orders")
          .select(["refunded_total", "total"])
          .where("id", "=", order.id)
          .executeTakeFirstOrThrow();
        const refunded_total = Math.min(current.total, current.refunded_total + refund.amount);
        const is_full = refunded_total >= current.total;
        const payment_status = is_full ? "refunded" : "partially_refunded";
        await trx
          .updateTable("orders")
          .set({ refunded_total, payment_status, ...(is_full ? { status: "refunded" } : {}), updated_at: nowIso() })
          .where("id", "=", order.id)
          .execute();
        if (is_full) {
          await trx
            .updateTable("payments")
            .set({ status: "refunded", updated_at: nowIso() })
            .where("order_id", "=", order.id)
            .where("status", "=", "succeeded")
            .execute();
        }
        await trx
          .insertInto("refunds")
          .values({
            id: newId(),
            order_id: order.id,
            amount: refund.amount,
            lines: refund.lines,
            reason: refund.reason,
            restocked: refund.restock,
            provider_ref: refund.provider_ref,
            actor_id: refund.actor || null,
          })
          .execute();
        await addEvent(trx, order.id, {
          type: "refund",
          from_status: order.payment_status,
          to_status: payment_status,
          message: refund.reason,
          actor: refund.actor,
          is_customer_visible: true,
        });
        if (refund.restock && refund.lines.length > 0) {
          const items = await trx
            .selectFrom("order_items")
            .select(["id", "variant_id"])
            .where("order_id", "=", order.id)
            .execute();
          for (const line of refund.lines) {
            const variant_id = items.find((item) => item.id === line.item_id)?.variant_id;
            if (!variant_id) continue;
            await changeStockLogged(trx, variant_id, line.quantity, {
              reason: "restock",
              note: `#${order.order_number}`,
              actor_id: refund.actor,
            });
          }
        }
        return { refunded_total, is_full };
      });
    },

    async updateTracking(order, tracking, { actor, ship }) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("orders")
          .set({ ...tracking, ...(ship ? { status: "shipped", shipped_at: nowIso() } : {}), updated_at: nowIso() })
          .where("id", "=", order.id)
          .execute();
        await addEvent(trx, order.id, {
          type: ship ? "shipped" : "note",
          from_status: ship ? order.status : "",
          to_status: ship ? "shipped" : "",
          message: [tracking.carrier, tracking.tracking_number].filter(Boolean).join(" · "),
          actor,
          // A tracking update without shipping is internal bookkeeping.
          is_customer_visible: ship,
        });
      });
    },

    async addNote(order_id, note) {
      await addEvent(db, order_id, { type: "note", ...note });
    },

    async setInternalNote(order_id, internal_note) {
      await db.updateTable("orders").set({ internal_note, updated_at: nowIso() }).where("id", "=", order_id).execute();
    },
  };
}
