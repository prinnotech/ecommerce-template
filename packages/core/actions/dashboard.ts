"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderRow, ReportOrder } from "@repo/core/backend/types";
import { ok, type ActionResult } from "@repo/core/lib/action-result";
import { authorize } from "@repo/core/lib/auth";
import { countsAsSale, OPEN_STATUSES } from "@repo/core/lib/orders";
import { dashboard_range_schema, type DashboardRange } from "@repo/core/lib/schemas/orders";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

const DAY_MS = 86_400_000;

export type DailySales = { date: string; sales: number; orders: number };

export type DashboardStats = {
  range: DashboardRange;
  currency: string;
  gross_sales: number;
  orders: number;
  average_order_value: number;
  // Same figures for the previous period of equal length, for the change badges.
  previous: { gross_sales: number; orders: number; average_order_value: number };
  to_fulfill: number;
  cod_to_collect: number;
  daily: DailySales[];
  top_products: { key: string; title: string; product_id: string; quantity: number; revenue: number }[];
  recent_orders: AdminOrderRow[];
  low_stock: { variant_id: string; product_id: string; title: string; label: string; stock: number }[];
};

// Calendar day (YYYY-MM-DD) in the store's time zone, so "today" matches the owner's day.
function dayKey(date: Date, time_zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Backends write dates as "YYYY-MM-DD HH:MM:SS" (PocketBase) or ISO with "T" (Postgres).
function parseDate(value: string): Date {
  return new Date(value.replace(" ", "T"));
}

function summarize(orders: Pick<ReportOrder, "status" | "total">[]) {
  const sales = orders.filter((order) => countsAsSale(order.status));
  const gross_sales = sales.reduce((sum, order) => sum + order.total, 0);
  return {
    gross_sales,
    orders: sales.length,
    average_order_value: sales.length > 0 ? Math.round(gross_sales / sales.length) : 0,
  };
}

// Reads a small store's orders in memory; a large catalog would move this to a SQL view.
export async function getDashboardStats(input: string): Promise<ActionResult<DashboardStats>> {
  const auth = await authorize("orders.view", "view sales reports");
  if (!auth.ok) return auth;
  const range = dashboard_range_schema.parse(input);
  const days = Number(range);

  try {
    const reports = getBackend().reports;
    const settings = await getSiteSettings();
    const now = Date.now();
    const from = new Date(now - days * DAY_MS);
    const previous_from = new Date(now - 2 * days * DAY_MS);

    const [period_orders, to_fulfill, cod_to_collect, recent_orders, items, low_stock] = await Promise.all([
      reports.ordersSince(previous_from.toISOString()),
      reports.countOrdersWithStatus(OPEN_STATUSES),
      reports.codToCollect(),
      reports.recentOrders(6),
      reports.soldItemsSince(from.toISOString()),
      reports.lowStock(settings.LOW_STOCK_THRESHOLD, 8),
    ]);

    const current = period_orders.filter((order) => parseDate(order.created_at) >= from);
    const previous = period_orders.filter((order) => parseDate(order.created_at) < from);

    // One bucket per day, including days without sales, so the chart's x-axis is continuous.
    const daily = new Map<string, DailySales>();
    for (let index = days - 1; index >= 0; index--) {
      const key = dayKey(new Date(now - index * DAY_MS), settings.TIMEZONE);
      daily.set(key, { date: key, sales: 0, orders: 0 });
    }
    for (const order of current) {
      if (!countsAsSale(order.status)) continue;
      const bucket = daily.get(dayKey(parseDate(order.created_at), settings.TIMEZONE));
      if (bucket) {
        bucket.sales += order.total;
        bucket.orders += 1;
      }
    }

    const products = new Map<string, DashboardStats["top_products"][number]>();
    for (const item of items) {
      const key = item.product || item.title;
      const entry = products.get(key) ?? { key, title: item.title, product_id: item.product, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.line_total;
      products.set(key, entry);
    }

    return ok({
      range,
      currency: settings.CURRENCY,
      ...summarize(current),
      previous: summarize(previous),
      to_fulfill,
      cod_to_collect,
      daily: [...daily.values()],
      top_products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      recent_orders,
      low_stock: low_stock.map((variant) => {
        const title = variant.product_title;
        return {
          variant_id: variant.variant_id,
          product_id: variant.product_id,
          title: title[settings.DEFAULT_LOCALE] || Object.values(title).find(Boolean) || variant.sku,
          label: [variant.color, variant.size].filter(Boolean).join(" / "),
          stock: variant.stock,
        };
      }),
    });
  } catch (error) {
    return failFrom(error, "dashboard", "getDashboardStats");
  }
}
