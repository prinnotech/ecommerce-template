"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { authorize } from "@/lib/auth";
import { countsAsSale, OPEN_STATUSES } from "@/lib/orders";
import { ORDER_ROW_FIELDS, toOrderRows, type AdminOrderRow, type OrderRecord } from "@/lib/orders-server";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { dashboard_range_schema, type DashboardRange } from "@/lib/schemas/orders";
import { reportError } from "@/lib/server-log";
import { getSiteSettings } from "@/lib/site-settings-server";

const DAY_MS = 86_400_000;
const LOW_STOCK = 5;

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

function summarize(orders: Pick<OrderRecord, "status" | "total">[]) {
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
    const [pb, settings] = await Promise.all([createAdminPocketBase(), getSiteSettings()]);
    const now = Date.now();
    const from = new Date(now - days * DAY_MS).toISOString().replace("T", " ");
    const previous_from = new Date(now - 2 * days * DAY_MS).toISOString().replace("T", " ");

    const [period_orders, open_orders, cod_unpaid, recent, items, low_stock] = await Promise.all([
      pb.collection("orders").getFullList<OrderRecord>({
        filter: pb.filter('created_at >= {:from} && deleted_at = ""', { from: previous_from }),
        fields: "created_at,status,total",
      }),
      pb.collection("orders").getList(1, 1, {
        filter: `(${OPEN_STATUSES.map((status) => `status = "${status}"`).join(" || ")}) && deleted_at = ""`,
        fields: "id",
      }),
      pb.collection("orders").getFullList({
        filter:
          'payment_method = "cash_on_delivery" && payment_status = "unpaid" && status != "cancelled" && status != "refunded" && deleted_at = ""',
        fields: "total",
      }),
      pb.collection("orders").getList<OrderRecord>(1, 6, {
        filter: 'deleted_at = ""',
        sort: "-created_at",
        fields: ORDER_ROW_FIELDS,
        skipTotal: true,
      }),
      pb.collection("order_items").getFullList({
        filter: pb.filter(
          'order.created_at >= {:from} && order.status != "cancelled" && order.status != "refunded" && order.deleted_at = ""',
          { from },
        ),
        fields: "product,title,quantity,line_total",
      }),
      pb.collection("product_variants").getList(1, 8, {
        filter: pb.filter('stock <= {:low} && is_active = true && product.deleted_at = ""', { low: LOW_STOCK }),
        sort: "stock",
        expand: "product",
        skipTotal: true,
      }),
    ]);

    const current = period_orders.filter((order) => order.created_at >= from);
    const previous = period_orders.filter((order) => order.created_at < from);

    // One bucket per day, including days without sales, so the chart's x-axis is continuous.
    const daily = new Map<string, DailySales>();
    for (let index = days - 1; index >= 0; index--) {
      const key = dayKey(new Date(now - index * DAY_MS), settings.TIMEZONE);
      daily.set(key, { date: key, sales: 0, orders: 0 });
    }
    for (const order of current) {
      if (!countsAsSale(order.status)) continue;
      const bucket = daily.get(dayKey(new Date(order.created_at.replace(" ", "T")), settings.TIMEZONE));
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

    type VariantWithProduct = (typeof low_stock.items)[number] & {
      expand?: { product?: { id: string; title: Record<string, string> | null } };
    };

    return ok({
      range,
      currency: settings.CURRENCY,
      ...summarize(current),
      previous: summarize(previous),
      to_fulfill: open_orders.totalItems,
      cod_to_collect: cod_unpaid.reduce((sum, order) => sum + order.total, 0),
      daily: [...daily.values()],
      top_products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      recent_orders: await toOrderRows(pb, recent.items),
      low_stock: (low_stock.items as VariantWithProduct[]).map((variant) => {
        const title = variant.expand?.product?.title ?? {};
        return {
          variant_id: variant.id,
          product_id: variant.product,
          title: title[settings.DEFAULT_LOCALE] || Object.values(title).find(Boolean) || variant.sku,
          label: [variant.color, variant.size].filter(Boolean).join(" / "),
          stock: variant.stock,
        };
      }),
    });
  } catch (error) {
    await reportError("dashboard", "getDashboardStats", error);
    return fail("generic");
  }
}
