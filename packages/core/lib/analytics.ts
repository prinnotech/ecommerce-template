import { z } from "zod";

import type { AnalyticsItem, AnalyticsOrder } from "@repo/core/backend/types";
import { fromZonedInput, toZonedInput } from "@repo/core/lib/utils/zoned-input";

// Analytics (admin): date ranges in the store's time zone, compared with the period before.
// Pure: the action fetches, this computes (so every backend gives the same numbers).

export const ANALYTICS_RANGES = [
  "today",
  "last_7",
  "last_30",
  "last_90",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const date_schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const analytics_filters_schema = z.object({
  range: z.enum(ANALYTICS_RANGES).catch("last_30"),
  from: z.union([date_schema, z.literal("")]).catch(""),
  to: z.union([date_schema, z.literal("")]).catch(""),
});
export type AnalyticsFilters = z.infer<typeof analytics_filters_schema>;

export type Bucket = "hour" | "day" | "week" | "month";

export type ResolvedRange = {
  // [from, to) as ISO instants, and the period of the same length right before.
  from: string;
  to: string;
  previous_from: string;
  previous_to: string;
  // Inclusive local dates, for the date inputs and labels.
  from_date: string;
  to_date: string;
  bucket: Bucket;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function startOf(date: string, unit: "month" | "year"): string {
  return unit === "month" ? `${date.slice(0, 7)}-01` : `${date.slice(0, 4)}-01-01`;
}

export function resolveRange(filters: AnalyticsFilters, time_zone: string, now = new Date()): ResolvedRange {
  const today = toZonedInput(now.toISOString(), time_zone).slice(0, 10);
  let from_date = addDays(today, -29);
  let to_date = today;
  switch (filters.range) {
    case "today":
      from_date = today;
      break;
    case "last_7":
      from_date = addDays(today, -6);
      break;
    case "last_90":
      from_date = addDays(today, -89);
      break;
    case "this_month":
      from_date = startOf(today, "month");
      break;
    case "last_month": {
      const first_this = startOf(today, "month");
      to_date = addDays(first_this, -1);
      from_date = startOf(to_date, "month");
      break;
    }
    case "this_year":
      from_date = startOf(today, "year");
      break;
    case "custom":
      if (filters.from && filters.to && filters.from <= filters.to) {
        from_date = filters.from;
        to_date = filters.to;
      }
      break;
    default:
      break;
  }
  const from = fromZonedInput(`${from_date}T00:00`, time_zone);
  const to = fromZonedInput(`${addDays(to_date, 1)}T00:00`, time_zone);
  const length = new Date(to).getTime() - new Date(from).getTime();
  const days = Math.round(length / DAY_MS);
  const bucket: Bucket = days <= 1 ? "hour" : days <= 45 ? "day" : days <= 200 ? "week" : "month";
  return {
    from,
    to,
    previous_from: new Date(new Date(from).getTime() - length).toISOString(),
    previous_to: from,
    from_date,
    to_date,
    bucket,
  };
}

// The bucket a moment falls in, as a local key: "2026-11-07T14", "2026-11-07", Monday's date, "2026-11".
function bucketKey(iso: string, bucket: Bucket, time_zone: string): string {
  const local = toZonedInput(iso, time_zone);
  if (bucket === "hour") return local.slice(0, 13);
  if (bucket === "month") return local.slice(0, 7);
  const date = local.slice(0, 10);
  if (bucket === "day") return date;
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

// Every bucket of the range, in order (empty ones included, so the chart has no gaps).
function bucketKeys(range: Pick<ResolvedRange, "from" | "to" | "bucket">, time_zone: string): string[] {
  const keys: string[] = [];
  const step = range.bucket === "hour" ? 60 * 60 * 1000 : DAY_MS;
  for (let time = new Date(range.from).getTime(); time < new Date(range.to).getTime(); time += step) {
    const key = bucketKey(new Date(time).toISOString(), range.bucket, time_zone);
    if (keys.at(-1) !== key) keys.push(key);
  }
  return keys;
}

const COUNTED = (order: AnalyticsOrder) => order.status !== "cancelled" && order.status !== "refunded";

export type AnalyticsTotals = {
  sales: number;
  orders: number;
  average_order: number;
  customers: number;
  returning_rate: number;
  conversion_rate: number;
  discounts: number;
};

export type AnalyticsPoint = {
  key: string;
  sales: number;
  orders: number;
  previous_sales: number;
  previous_orders: number;
};

export type AnalyticsResult = {
  range: ResolvedRange;
  totals: AnalyticsTotals;
  previous: AnalyticsTotals;
  series: AnalyticsPoint[];
  top_products: { product: string; title: string; quantity: number; revenue: number }[];
  by_category: { category_id: string; quantity: number; revenue: number }[];
  discounts: { discount_code: string; orders: number; amount: number }[];
};

function totalsOf(
  orders: AnalyticsOrder[],
  returning: Set<string>,
  checkouts: { started: number; completed: number },
): AnalyticsTotals {
  const counted = orders.filter(COUNTED);
  const sales = counted.reduce((sum, order) => sum + order.total - order.refunded_total, 0);
  const emails = new Set(counted.map((order) => order.email).filter(Boolean));
  const returning_count = [...emails].filter((email) => returning.has(email)).length;
  return {
    sales,
    orders: counted.length,
    average_order: counted.length > 0 ? Math.round(sales / counted.length) : 0,
    customers: emails.size,
    returning_rate: emails.size > 0 ? returning_count / emails.size : 0,
    conversion_rate: checkouts.started > 0 ? checkouts.completed / checkouts.started : 0,
    discounts: counted.reduce((sum, order) => sum + order.discount_total, 0),
  };
}

export function computeAnalytics(input: {
  range: ResolvedRange;
  time_zone: string;
  orders: AnalyticsOrder[];
  previous_orders: AnalyticsOrder[];
  items: AnalyticsItem[];
  // Emails that ordered before each period (for the returning-customer rate).
  returning: Set<string>;
  previous_returning: Set<string>;
  checkouts: { started: number; completed: number };
  previous_checkouts: { started: number; completed: number };
}): AnalyticsResult {
  const { range, time_zone } = input;
  const keys = bucketKeys(range, time_zone);
  const previous_range = { from: range.previous_from, to: range.previous_to, bucket: range.bucket };
  const previous_keys = bucketKeys(previous_range, time_zone);
  const points = new Map(keys.map((key) => [key, { key, sales: 0, orders: 0, previous_sales: 0, previous_orders: 0 }]));

  for (const order of input.orders.filter(COUNTED)) {
    const point = points.get(bucketKey(order.created_at, range.bucket, time_zone));
    if (!point) continue;
    point.sales += order.total - order.refunded_total;
    point.orders += 1;
  }
  // The previous period lines up by position (day 1 with day 1).
  const previous_index = new Map(previous_keys.map((key, index) => [key, index]));
  for (const order of input.previous_orders.filter(COUNTED)) {
    const index = previous_index.get(bucketKey(order.created_at, range.bucket, time_zone));
    const point = index === undefined ? undefined : points.get(keys[index] ?? "");
    if (!point) continue;
    point.previous_sales += order.total - order.refunded_total;
    point.previous_orders += 1;
  }

  const products = new Map<string, { product: string; title: string; quantity: number; revenue: number }>();
  const categories = new Map<string, { category_id: string; quantity: number; revenue: number }>();
  for (const item of input.items) {
    const key = item.product || `title:${item.title}`;
    const product = products.get(key) ?? { product: item.product, title: item.title, quantity: 0, revenue: 0 };
    product.quantity += item.quantity;
    product.revenue += item.line_total;
    products.set(key, product);
    const category = categories.get(item.category_id) ?? { category_id: item.category_id, quantity: 0, revenue: 0 };
    category.quantity += item.quantity;
    category.revenue += item.line_total;
    categories.set(item.category_id, category);
  }

  const discounts = new Map<string, { discount_code: string; orders: number; amount: number }>();
  for (const order of input.orders.filter(COUNTED)) {
    if (!order.discount_code) continue;
    const entry = discounts.get(order.discount_code) ?? { discount_code: order.discount_code, orders: 0, amount: 0 };
    entry.orders += 1;
    entry.amount += order.discount_total;
    discounts.set(order.discount_code, entry);
  }

  return {
    range,
    totals: totalsOf(input.orders, input.returning, input.checkouts),
    previous: totalsOf(input.previous_orders, input.previous_returning, input.previous_checkouts),
    series: [...points.values()],
    top_products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    by_category: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    discounts: [...discounts.values()].sort((a, b) => b.orders - a.orders).slice(0, 10),
  };
}

// Change against the previous period (null when there's nothing to compare with).
export function changeRatio(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
