"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { ok, type ActionResult } from "@repo/core/lib/action-result";
import {
  analytics_filters_schema,
  computeAnalytics,
  resolveRange,
  type AnalyticsFilters,
  type AnalyticsResult,
} from "@repo/core/lib/analytics";
import { authorize } from "@repo/core/lib/auth";
import type { LocalizedText } from "@repo/core/lib/localized";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export type AnalyticsView = AnalyticsResult & {
  currency: string;
  time_zone: string;
  category_names: Record<string, LocalizedText>;
  discount_codes: Record<string, string>;
};

export async function getAnalytics(input: Partial<AnalyticsFilters>): Promise<ActionResult<AnalyticsView>> {
  const auth = await authorize("analytics.view", "view analytics");
  if (!auth.ok) return auth;
  const filters = analytics_filters_schema.parse(input);
  try {
    const settings = await getSiteSettings();
    const time_zone = settings.TIMEZONE;
    const range = resolveRange(filters, time_zone);
    const { reports, catalog, checkout } = getBackend();
    const [orders, previous_orders, items, checkouts, previous_checkouts, categories] = await Promise.all([
      reports.analyticsOrders(range.from, range.to),
      reports.analyticsOrders(range.previous_from, range.previous_to),
      reports.analyticsItems(range.from, range.to),
      reports.checkoutsBetween(range.from, range.to),
      reports.checkoutsBetween(range.previous_from, range.previous_to),
      catalog.listCategories(),
    ]);
    const emails = (list: typeof orders) => [...new Set(list.map((order) => order.email).filter(Boolean))];
    const [returning, previous_returning] = await Promise.all([
      reports.emailsWithOrdersBefore(range.from, emails(orders)),
      reports.emailsWithOrdersBefore(range.previous_from, emails(previous_orders)),
    ]);
    const result = computeAnalytics({
      range,
      time_zone,
      orders,
      previous_orders,
      items,
      returning: new Set(returning),
      previous_returning: new Set(previous_returning),
      checkouts,
      previous_checkouts,
    });
    const codes = await Promise.all(
      result.discounts.map(
        async (entry) => [entry.discount_code, (await checkout.getDiscountCode(entry.discount_code)) ?? "—"] as const,
      ),
    );
    return ok({
      ...result,
      currency: settings.CURRENCY,
      time_zone,
      category_names: Object.fromEntries(categories.map((category) => [category.id, category.name])),
      discount_codes: Object.fromEntries(codes),
    });
  } catch (error) {
    return failFrom(error, "analytics", "getAnalytics");
  }
}
