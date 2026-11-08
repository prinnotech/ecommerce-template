import "server-only";

import { sql } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { CheckoutBackend, CheckoutSession } from "@repo/core/backend/types";
import type { PricedLine } from "@repo/core/lib/checkout/checkout-server";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { OrderStatus, PaymentMethod } from "@repo/core/lib/orders";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { SqlContext } from "@repo/backend-sql/context";
import { checkViolation, uniqueViolation } from "@repo/backend-sql/errors";
import { toDiscountCode } from "@repo/backend-sql/discounts";
import { changeStockLogged } from "@repo/backend-sql/inventory";
import type { Database } from "@repo/backend-sql/schema";
import { imagesFor, sellableVariant } from "@repo/backend-sql/storefront";
import { iso, json, newId, nowIso } from "@repo/backend-sql/values";
import { parseAttribution } from "@repo/core/lib/tracking/attribution";

// Checkout sessions, payments and discount codes are only reachable from the server.
// Possessing the session id is what authorizes access to that one session.

const FIRST_ORDER_NUMBER = 1001;
const ORDER_NUMBER_ATTEMPTS = 5;

type SessionRow = Database["checkout_sessions"] extends infer T ? { [K in keyof T]: unknown } : never;

function toSession(row: SessionRow): CheckoutSession {
  return {
    id: String(row.id),
    user: String(row.user_id ?? ""),
    email: String(row.email ?? ""),
    locale: String(row.locale ?? ""),
    line_items: json<PricedLine[]>(row.line_items, []),
    currency: String(row.currency ?? ""),
    subtotal: Number(row.subtotal),
    discount_total: Number(row.discount_total),
    shipping_total: Number(row.shipping_total),
    tax_total: Number(row.tax_total),
    cod_fee: Number(row.cod_fee),
    total: Number(row.total),
    shipping_method: String(row.shipping_method ?? ""),
    payment_method: String(row.payment_method ?? "") as PaymentMethod | "",
    discount_code: String(row.discount_code_id ?? ""),
    status: String(row.status) as CheckoutSession["status"],
    expires_at: iso(row.expires_at),
    shipping_address: json<AddressFields | null>(row.shipping_address, null),
    billing_address: json<AddressFields | null>(row.billing_address, null),
    customer_note: String(row.customer_note ?? ""),
    attribution: row.attribution ? parseAttribution(json(row.attribution, null)) : null,
    gift_card_id: String(row.gift_card_id ?? ""),
    gift_card_amount: Number(row.gift_card_amount ?? 0),
  };
}

// Session fields as columns: "user" and "discount_code" are ids in the table.
function sessionColumns(patch: Partial<CheckoutSession>) {
  const { user, discount_code, id: _id, ...rest } = patch;
  return {
    ...rest,
    ...(user !== undefined ? { user_id: user || null } : {}),
    ...(discount_code !== undefined ? { discount_code_id: discount_code || null } : {}),
  };
}

export function createCheckout(ctx: SqlContext): CheckoutBackend {
  const { db } = ctx;
  return {
    async pricingVariants(variant_ids) {
      const rows = await db
        .selectFrom("product_variants")
        .innerJoin("products", "products.id", "product_variants.product_id")
        .select([
          "product_variants.id as variant_id",
          "products.id as product_id",
          "products.slug",
          "products.title",
          "product_variants.size",
          "product_variants.color",
          "product_variants.sku",
          "product_variants.price_override",
          "products.price as product_price",
          "products.compare_at_price",
          "product_variants.stock",
        ])
        .where("product_variants.id", "in", variant_ids)
        .where(sellableVariant)
        .where("products.status", "=", "active")
        .where("products.deleted_at", "is", null)
        .execute();
      const images = await imagesFor(ctx, [...new Set(rows.map((row) => row.product_id))], 100);
      return rows.map((row) => ({
        ...row,
        title: json<LocalizedText>(row.title, {}),
        image: images.get(row.product_id)?.[0] ?? "",
      }));
    },

    async findDiscount(code) {
      const row = await db.selectFrom("discount_codes").selectAll().where("code", "=", code).executeTakeFirst();
      if (!row || row.deleted_at) return null;
      return toDiscountCode(row);
    },

    async getDiscountCode(id) {
      const row = await db.selectFrom("discount_codes").select("code").where("id", "=", id).executeTakeFirst();
      return row?.code ?? null;
    },

    async createSession(session) {
      const id = newId();
      await db
        .insertInto("checkout_sessions")
        .values({ id, ...sessionColumns(session), expires_at: session.expires_at })
        .execute();
      return { id };
    },

    async getSession(id) {
      const row = await db.selectFrom("checkout_sessions").selectAll().where("id", "=", id).executeTakeFirst();
      return row ? toSession(row) : null;
    },

    async updateSession(id, patch) {
      await db
        .updateTable("checkout_sessions")
        .set({ ...sessionColumns(patch), updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
    },

    async recordFailedPayment(payment) {
      await db
        .insertInto("payments")
        .values({
          id: newId(),
          checkout_session_id: payment.session_id,
          provider: "card",
          amount: payment.amount,
          currency: payment.currency,
          status: "failed",
          error_code: payment.error_code,
        })
        .execute();
    },

    // One transaction. The stock column's CHECK (stock >= 0) fails an oversell, which rolls
    // everything back. order_number is the next free number; a clash with a parallel checkout
    // (unique index) is retried.
    async placeOrder(order, lines, session_patch) {
      for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt++) {
        try {
          return await db.transaction().execute(async (trx) => {
            const last = await trx
              .selectFrom("orders")
              .select((eb) => eb.fn.max("order_number").as("max"))
              .executeTakeFirst();
            const order_number = Math.max(Number(last?.max ?? 0) + 1, FIRST_ORDER_NUMBER);
            const order_id = newId();
            const { user, discount_code, checkout_session, payment, ...fields } = order;

            await trx
              .insertInto("orders")
              .values({
                id: order_id,
                order_number,
                ...fields,
                user_id: user || null,
                discount_code_id: discount_code || null,
                checkout_session_id: checkout_session,
              })
              .execute();
            for (const line of lines) {
              await trx
                .insertInto("order_items")
                .values({
                  id: newId(),
                  order_id,
                  // Custom lines (draft orders) have no product, no variant and no stock.
                  product_id: line.product_id || null,
                  variant_id: line.variant_id || null,
                  title: line.title,
                  variant_label: line.variant_label,
                  sku: line.sku,
                  image: line.image,
                  unit_price: line.unit_price,
                  quantity: line.quantity,
                  line_total: line.line_total,
                })
                .execute();
              if (!line.variant_id) continue;
              await changeStockLogged(trx, line.variant_id, -line.quantity, {
                reason: "order",
                note: `#${order_number}`,
                actor_id: "",
              });
            }
            await trx
              .insertInto("order_events")
              .values({ id: newId(), order_id, type: "created", is_customer_visible: true })
              .execute();
            await trx
              .insertInto("payments")
              .values({
                id: newId(),
                order_id,
                checkout_session_id: checkout_session,
                provider: order.payment_method,
                provider_ref: payment?.provider_ref ?? "",
                amount: order.total - (order.gift_card_total ?? 0),
                currency: order.currency,
                status: payment?.status ?? "pending",
              })
              .execute();
            if (discount_code) {
              await trx
                .updateTable("discount_codes")
                .set({ used_count: sql`used_count + 1` })
                .where("id", "=", discount_code)
                .execute();
            }
            await trx
              .updateTable("checkout_sessions")
              .set({ ...sessionColumns(session_patch), status: "completed", updated_at: nowIso() })
              .where("id", "=", checkout_session)
              .execute();
            return { order_number };
          });
        } catch (error) {
          if (checkViolation(error)) throw new BackendError("out_of_stock");
          if (uniqueViolation(error)?.includes("order_number") && attempt < ORDER_NUMBER_ATTEMPTS) continue;
          throw error;
        }
      }
      throw new Error("Could not allocate an order number");
    },

    async orderForSession(session_id) {
      const row = await db
        .selectFrom("orders")
        .selectAll()
        .where("checkout_session_id", "=", session_id)
        .executeTakeFirst();
      if (!row) return null;
      return {
        order_number: row.order_number,
        email: row.email,
        status: row.status as OrderStatus,
        payment_method: row.payment_method as PaymentMethod | "",
        currency: row.currency,
        subtotal: row.subtotal,
        discount_total: row.discount_total,
        shipping_total: row.shipping_total,
        tax_total: row.tax_total,
        cod_fee: row.cod_fee,
        total: row.total,
        gift_card_total: row.gift_card_total,
        shipping_address: json<AddressFields | null>(row.shipping_address, null),
        shipping_method: row.shipping_method,
        user: row.user_id ?? "",
      };
    },
  };
}
