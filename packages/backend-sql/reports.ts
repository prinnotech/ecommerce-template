import "server-only";

import type { ReportsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { OrderStatus } from "@repo/core/lib/orders";
import { toCount, type SqlContext } from "@repo/backend-sql/context";
import { ORDER_ROW_COLUMNS, rowsQuery, toOrderRows } from "@repo/backend-sql/orders";
import { iso, json } from "@repo/backend-sql/values";

export function createReports({ db }: SqlContext): ReportsBackend {
  return {
    async ordersSince(from) {
      const rows = await rowsQuery(db)
        .select(["orders.created_at", "orders.status", "orders.total"])
        .where("orders.created_at", ">=", from)
        .execute();
      return rows.map((row) => ({
        created_at: iso(row.created_at),
        status: row.status as OrderStatus,
        total: row.total,
      }));
    },

    async countOrdersWithStatus(statuses) {
      return toCount(
        await rowsQuery(db)
          .select((eb) => eb.fn.countAll().as("count"))
          .where("orders.status", "in", [...statuses])
          .executeTakeFirst(),
      );
    },

    async codToCollect() {
      const row = await rowsQuery(db)
        .select((eb) => eb.fn.sum("orders.total").as("total"))
        .where("orders.payment_method", "=", "cash_on_delivery")
        .where("orders.payment_status", "=", "unpaid")
        .where("orders.status", "not in", ["cancelled", "refunded"])
        .executeTakeFirst();
      return Number(row?.total ?? 0);
    },

    async recentOrders(limit) {
      return toOrderRows(
        db,
        await rowsQuery(db)
          .select([...ORDER_ROW_COLUMNS])
          .orderBy("orders.created_at", "desc")
          .limit(limit)
          .execute(),
      );
    },

    async soldItemsSince(from) {
      const rows = await db
        .selectFrom("order_items")
        .innerJoin("orders", "orders.id", "order_items.order_id")
        .select(["order_items.product_id", "order_items.title", "order_items.quantity", "order_items.line_total"])
        .where("orders.created_at", ">=", from)
        .where("orders.status", "not in", ["cancelled", "refunded"])
        .where("orders.deleted_at", "is", null)
        .execute();
      return rows.map((row) => ({
        product: row.product_id ?? "",
        title: row.title,
        quantity: row.quantity,
        line_total: row.line_total,
      }));
    },

    async lowStock(threshold, limit) {
      const rows = await db
        .selectFrom("product_variants")
        .innerJoin("products", "products.id", "product_variants.product_id")
        .select([
          "product_variants.id",
          "product_variants.product_id",
          "products.title",
          "product_variants.sku",
          "product_variants.color",
          "product_variants.size",
          "product_variants.stock",
        ])
        .where("product_variants.stock", "<=", threshold)
        .where("product_variants.is_active", "=", true)
        .where("products.deleted_at", "is", null)
        .orderBy("product_variants.stock")
        .limit(limit)
        .execute();
      return rows.map((row) => ({
        variant_id: row.id,
        product_id: row.product_id,
        product_title: json<LocalizedText>(row.title, {}),
        sku: row.sku,
        color: row.color,
        size: row.size,
        stock: row.stock,
      }));
    },
    async analyticsOrders(from, to) {
      const rows = await rowsQuery(db)
        .select([
          "orders.created_at",
          "orders.status",
          "orders.total",
          "orders.refunded_total",
          "orders.discount_total",
          "orders.discount_code_id",
          "orders.email",
        ])
        .where("orders.created_at", ">=", from)
        .where("orders.created_at", "<", to)
        .execute();
      return rows.map((row) => ({
        created_at: iso(row.created_at),
        status: row.status as OrderStatus,
        total: row.total,
        refunded_total: row.refunded_total,
        discount_total: row.discount_total,
        discount_code: row.discount_code_id ?? "",
        email: row.email.toLowerCase(),
      }));
    },

    async analyticsItems(from, to) {
      const rows = await db
        .selectFrom("order_items")
        .innerJoin("orders", "orders.id", "order_items.order_id")
        .leftJoin("products", "products.id", "order_items.product_id")
        .select([
          "order_items.product_id",
          "order_items.title",
          "order_items.quantity",
          "order_items.line_total",
          "products.category_id",
        ])
        .where("orders.created_at", ">=", from)
        .where("orders.created_at", "<", to)
        .where("orders.status", "not in", ["cancelled", "refunded"])
        .where("orders.deleted_at", "is", null)
        .execute();
      return rows.map((row) => ({
        product: row.product_id ?? "",
        title: row.title,
        category_id: row.category_id ?? "",
        quantity: row.quantity,
        line_total: row.line_total,
      }));
    },

    async emailsWithOrdersBefore(before, emails) {
      if (emails.length === 0) return [];
      const found = new Set<string>();
      // Chunks keep the IN list short.
      for (let start = 0; start < emails.length; start += 200) {
        const rows = await rowsQuery(db)
          .select("orders.email")
          .distinct()
          .where("orders.created_at", "<", before)
          .where((eb) => eb(eb.fn("lower", ["orders.email"]), "in", emails.slice(start, start + 200)))
          .execute();
        for (const row of rows) found.add(row.email.toLowerCase());
      }
      return [...found];
    },

    async checkoutsBetween(from, to) {
      const rows = await db
        .selectFrom("checkout_sessions")
        .select(["status", (eb) => eb.fn.countAll().as("count")])
        .where("created_at", ">=", from)
        .where("created_at", "<", to)
        .groupBy("status")
        .execute();
      const started = rows.reduce((sum, row) => sum + Number(row.count), 0);
      const completed = Number(rows.find((row) => row.status === "completed")?.count ?? 0);
      return { started, completed };
    },
  };
}
