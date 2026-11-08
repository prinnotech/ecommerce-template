"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { bucketLabel, SalesChart } from "./sales-chart";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { getAnalytics } from "@repo/core/actions/analytics";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText, unwrap } from "@repo/core/lib/action-result";
import {
  ANALYTICS_RANGES,
  analytics_filters_schema,
  changeRatio,
  type AnalyticsFilters,
  type AnalyticsTotals,
} from "@repo/core/lib/analytics";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { query_keys } from "@repo/core/lib/query-keys";
import { formatCurrency, formatDate } from "@repo/core/lib/utils/format";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

type AnalyticsScreenProps = {
  lang: string;
  dictionary: AdminDictionary["analytics"];
  errors: AdminDictionary["errors"];
};

type Tile = { key: keyof AnalyticsTotals; format: (value: number) => string };

export function AnalyticsScreen({ lang, dictionary, errors }: AnalyticsScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = analytics_filters_schema.parse(Object.fromEntries(search_params));
  const analytics = useQuery({
    queryKey: query_keys.analytics(filters),
    queryFn: async () => unwrap(await getAnalytics(filters)),
    placeholderData: keepPreviousData,
  });
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const [is_table, setIsTable] = useState(false);
  const data = analytics.data;
  const locale = lang as Locale;

  function setFilters(next: AnalyticsFilters) {
    const params = new URLSearchParams();
    if (next.range !== "last_30") params.set("range", next.range);
    if (next.range === "custom") {
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const money = (cents: number) => formatCurrency(cents, data?.currency ?? "EUR", lang);
  const number = (value: number) => new Intl.NumberFormat(lang).format(value);
  const percent = (value: number) =>
    new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 }).format(value);
  const tiles: Tile[] = [
    { key: "sales", format: money },
    { key: "orders", format: number },
    { key: "average_order", format: money },
    { key: "returning_rate", format: percent },
    { key: "conversion_rate", format: percent },
    { key: "discounts", format: money },
  ];

  const range_picker = (
    <div className="flex flex-wrap items-end gap-2">
      <NativeSelect
        aria-label={dictionary.range}
        value={filters.range}
        onChange={(event) => {
          const range = ANALYTICS_RANGES.find((item) => item === event.target.value) ?? "last_30";
          setFilters({
            range,
            from: range === "custom" ? (data?.range.from_date ?? "") : "",
            to: range === "custom" ? (data?.range.to_date ?? "") : "",
          });
        }}
      >
        {ANALYTICS_RANGES.map((range) => (
          <NativeSelectOption key={range} value={range}>
            {dictionary.ranges[range]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {filters.range === "custom" && (
        <>
          <Input
            type="date"
            aria-label={dictionary.from}
            value={filters.from}
            className="h-9 w-40"
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
          <Input
            type="date"
            aria-label={dictionary.to}
            value={filters.to}
            className="h-9 w-40"
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </>
      )}
    </div>
  );

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full" secondary_actions={range_picker}>
      {analytics.isError && <p className="text-destructive text-sm">{errorText(errors, analytics.error)}</p>}
      {!data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", analytics.isFetching && "opacity-60")}>
          <p className="text-muted-foreground text-sm">
            {dictionary.period
              .replace("{from}", formatDay(data.range.from_date, lang))
              .replace("{to}", formatDay(data.range.to_date, lang))
              .replace("{zone}", data.time_zone)}
          </p>

          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {tiles.map((tile) => {
              const change = changeRatio(data.totals[tile.key], data.previous[tile.key]);
              return (
                <li key={tile.key} className="bg-card flex flex-col gap-1 rounded-xl border p-4">
                  <span className="text-muted-foreground text-xs">{dictionary.tiles[tile.key]}</span>
                  <span className="text-xl font-semibold tabular-nums">{tile.format(data.totals[tile.key])}</span>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    {change === null ? (
                      dictionary.no_previous
                    ) : (
                      <>
                        {change > 0 ? (
                          <ArrowUpIcon className="size-3" aria-hidden />
                        ) : change < 0 ? (
                          <ArrowDownIcon className="size-3" aria-hidden />
                        ) : null}
                        {dictionary.vs_previous.replace("{change}", percent(Math.abs(change)))}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <SectionCard
            title={metric === "sales" ? dictionary.sales_over_time : dictionary.orders_over_time}
            action={
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={metric === "sales" ? "secondary" : "ghost"}
                  onClick={() => setMetric("sales")}
                >
                  {dictionary.tiles.sales}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={metric === "orders" ? "secondary" : "ghost"}
                  onClick={() => setMetric("orders")}
                >
                  {dictionary.tiles.orders}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={is_table}
                  onClick={() => setIsTable((value) => !value)}
                >
                  {is_table ? dictionary.show_chart : dictionary.show_table}
                </Button>
              </div>
            }
          >
            {is_table ? (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-left text-xs">
                    <tr>
                      <th className="py-1 font-medium">{dictionary.date}</th>
                      <th className="py-1 text-right font-medium">{dictionary.current}</th>
                      <th className="py-1 text-right font-medium">{dictionary.previous}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((point) => (
                      <tr key={point.key} className="border-t">
                        <td className="py-1">{bucketLabel(point.key, data.range.bucket, lang)}</td>
                        <td className="py-1 text-right tabular-nums">
                          {metric === "sales" ? money(point.sales) : number(point.orders)}
                        </td>
                        <td className="text-muted-foreground py-1 text-right tabular-nums">
                          {metric === "sales" ? money(point.previous_sales) : number(point.previous_orders)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <SalesChart
                points={data.series}
                metric={metric}
                bucket={data.range.bucket}
                lang={lang}
                formatValue={metric === "sales" ? money : number}
                labels={{
                  current: dictionary.current,
                  previous: dictionary.previous,
                  chart: metric === "sales" ? dictionary.sales_over_time : dictionary.orders_over_time,
                }}
              />
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={dictionary.top_products}>
              <BarList
                rows={data.top_products.map((row) => ({
                  key: row.product || row.title,
                  label: row.title,
                  detail: dictionary.sold.replace("{count}", number(row.quantity)),
                  value: row.revenue,
                }))}
                format={money}
                empty={dictionary.empty}
              />
            </SectionCard>
            <SectionCard title={dictionary.by_category}>
              <BarList
                rows={data.by_category.map((row) => ({
                  key: row.category_id || "none",
                  label: row.category_id
                    ? localized(data.category_names[row.category_id] ?? {}, locale) || dictionary.no_category
                    : dictionary.no_category,
                  detail: dictionary.sold.replace("{count}", number(row.quantity)),
                  value: row.revenue,
                }))}
                format={money}
                empty={dictionary.empty}
              />
            </SectionCard>
          </div>

          <SectionCard title={dictionary.discount_usage}>
            {data.discounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{dictionary.empty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr>
                    <th className="py-1 font-medium">{dictionary.code}</th>
                    <th className="py-1 text-right font-medium">{dictionary.tiles.orders}</th>
                    <th className="py-1 text-right font-medium">{dictionary.tiles.discounts}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.discounts.map((row) => (
                    <tr key={row.discount_code} className="border-t">
                      <td className="py-1.5 font-mono">{data.discount_codes[row.discount_code] ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{number(row.orders)}</td>
                      <td className="py-1.5 text-right tabular-nums">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </div>
      )}
    </Page>
  );
}

// Ranked rows with a bar for the value: readable as a table, bars only add the comparison.
function BarList({
  rows,
  format,
  empty,
}: {
  rows: { key: string; label: string; detail: string; value: number }[];
  format: (value: number) => string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {row.label} <span className="text-muted-foreground text-xs">· {row.detail}</span>
            </span>
            <span className="tabular-nums">{format(row.value)}</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-primary h-full rounded-full" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// A calendar day ("2026-10-10") in the admin's language; noon UTC so no time zone moves it.
function formatDay(day: string, lang: string): string {
  return formatDate(`${day}T12:00:00Z`, lang, "UTC");
}
