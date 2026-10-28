import { ArrowDownRightIcon, ArrowUpRightIcon, PackageIcon, SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";
import { OrderRows } from "@/components/dashboard/order-rows";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { callerCan, requireCaller } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { dashboard_range_schema, DASHBOARD_RANGES, type DashboardRange } from "@/lib/schemas/orders";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/dashboard", title: dictionary.dashboard.meta_title, is_private: true });
}

const RANGE_KEYS: Record<DashboardRange, keyof Dictionary["dashboard"]["home"]["ranges"]> = {
  "7": "last_7_days",
  "30": "last_30_days",
  "90": "last_90_days",
};

export default async function DashboardHomePage({ params, searchParams }: PageProps<"/[lang]/dashboard">) {
  const { lang } = await params;
  const { range: range_param } = await searchParams;
  const range = dashboard_range_schema.parse(range_param);
  const [caller, dictionary] = await Promise.all([requireCaller(lang), getDictionary(lang)]);
  const text = dictionary.dashboard.home;
  const can_view_sales = callerCan(caller, "orders.view");
  const stats = can_view_sales ? await getDashboardStats(range) : null;

  const shortcuts = [
    {
      href: `/${lang}/dashboard/products`,
      Icon: PackageIcon,
      title: text.products_title,
      body: text.products_body,
      is_allowed: callerCan(caller, "products.view"),
    },
    {
      href: `/${lang}/dashboard/settings`,
      Icon: SettingsIcon,
      title: text.settings_title,
      body: text.settings_body,
      is_allowed: callerCan(caller, "settings.view"),
    },
  ].filter((shortcut) => shortcut.is_allowed);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
          <p className="text-muted-foreground text-sm">{text.welcome.replace("{name}", caller.name || caller.email)}</p>
        </div>
        {can_view_sales && (
          <nav aria-label={text.range_label} className="bg-muted flex gap-1 rounded-lg p-1">
            {DASHBOARD_RANGES.map((option) => (
              <Link
                key={option}
                href={`/${lang}/dashboard?range=${option}`}
                aria-current={option === range ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  option === range
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {text.ranges[RANGE_KEYS[option]]}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {stats && !stats.ok && <p className="text-destructive text-sm">{dictionary.errors[stats.error]}</p>}
      {stats?.ok && <SalesOverview lang={lang} stats={stats.data} dictionary={dictionary} range={range} />}

      {shortcuts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ href, Icon, title, body }) => (
            <Link key={href} href={href} className="group rounded-xl">
              <Card className="group-hover:bg-muted/40 h-full transition-colors">
                <CardHeader>
                  <Icon className="text-muted-foreground mb-2 size-5" aria-hidden />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SalesOverview({
  lang,
  stats,
  dictionary,
  range,
}: {
  lang: string;
  stats: DashboardStats;
  dictionary: Dictionary;
  range: DashboardRange;
}) {
  const text = dictionary.dashboard.home;
  const money = (cents: number) => formatCurrency(cents, stats.currency, lang);
  const range_label = text.ranges[RANGE_KEYS[range]].toLowerCase();

  const kpis = [
    {
      label: text.kpis.gross_sales,
      value: money(stats.gross_sales),
      current: stats.gross_sales,
      previous: stats.previous.gross_sales,
    },
    {
      label: text.kpis.orders,
      value: formatNumber(stats.orders, lang),
      current: stats.orders,
      previous: stats.previous.orders,
    },
    {
      label: text.kpis.average_order_value,
      value: money(stats.average_order_value),
      current: stats.average_order_value,
      previous: stats.previous.average_order_value,
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="sm:col-span-2 xl:col-span-4">
          <CardContent className="grid gap-6 sm:grid-cols-3">
            {kpis.map((kpi) => (
              <KpiStat key={kpi.label} lang={lang} vs_label={text.kpis.vs_previous} {...kpi} />
            ))}
          </CardContent>
        </Card>
        <Link href={`/${lang}/dashboard/orders?status=open`} className="group rounded-xl sm:col-span-1 xl:col-span-2">
          <Card className="group-hover:bg-muted/40 h-full transition-colors">
            <CardContent className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm">{text.kpis.to_fulfill}</span>
              <span className="text-2xl font-semibold tabular-nums">{formatNumber(stats.to_fulfill, lang)}</span>
              <span className="text-muted-foreground text-xs">{text.kpis.to_fulfill_hint}</span>
            </CardContent>
          </Card>
        </Link>
        <Link
          href={`/${lang}/dashboard/orders?payment=unpaid`}
          className="group rounded-xl sm:col-span-1 xl:col-span-2"
        >
          <Card className="group-hover:bg-muted/40 h-full transition-colors">
            <CardContent className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm">{text.kpis.cod_to_collect}</span>
              <span className="text-2xl font-semibold tabular-nums">{money(stats.cod_to_collect)}</span>
              <span className="text-muted-foreground text-xs">{text.kpis.cod_to_collect_hint}</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{text.chart.title}</CardTitle>
          <CardDescription>{text.chart.description.replace("{range}", range_label)}</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesChart
            daily={stats.daily}
            currency={stats.currency}
            lang={lang}
            labels={{ ...text.chart, description: text.chart.description.replace("{range}", range_label) }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="pb-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{text.recent_orders}</CardTitle>
            <Link href={`/${lang}/dashboard/orders`} className="text-sm font-medium underline-offset-4 hover:underline">
              {text.view_all}
            </Link>
          </CardHeader>
          {stats.recent_orders.length === 0 ? (
            <CardContent className="text-muted-foreground pb-6 text-sm">{text.no_orders}</CardContent>
          ) : (
            <OrderRows
              lang={lang}
              orders={stats.recent_orders}
              dictionary={dictionary.orders_admin}
              order_status={dictionary.order_status}
              payment_status={dictionary.payment_status}
              is_compact
            />
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{text.top_products}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.top_products.length === 0 ? (
                <p className="text-muted-foreground text-sm">{text.chart.empty}</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {stats.top_products.map((product, index) => (
                    <li key={product.key} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-4 tabular-nums">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        {product.product_id ? (
                          <Link
                            href={`/${lang}/dashboard/products/${product.product_id}`}
                            className="block truncate font-medium hover:underline"
                          >
                            {product.title}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium">{product.title}</span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {text.sold.replace("{count}", String(product.quantity))}
                        </span>
                      </div>
                      <span className="tabular-nums">{money(product.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.low_stock}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.low_stock.length === 0 ? (
                <p className="text-muted-foreground text-sm">{text.no_low_stock}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {stats.low_stock.map((variant) => (
                    <li key={variant.variant_id} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        href={`/${lang}/dashboard/products/${variant.product_id}`}
                        className="min-w-0 hover:underline"
                      >
                        <span className="block truncate font-medium">{variant.title}</span>
                        <span className="text-muted-foreground text-xs">{variant.label}</span>
                      </Link>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          variant.stock === 0 ? "text-destructive font-medium" : "text-muted-foreground",
                        )}
                      >
                        {text.units_left.replace("{count}", String(variant.stock))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function KpiStat({
  label,
  value,
  current,
  previous,
  lang,
  vs_label,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  lang: string;
  vs_label: string;
}) {
  // No change badge without a previous period to compare with.
  const change = previous > 0 ? (current - previous) / previous : null;
  const is_down = change !== null && change < 0;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      {change !== null && (
        <span className={cn("flex items-center gap-1 text-xs", is_down ? "text-destructive" : "text-muted-foreground")}>
          {is_down ? (
            <ArrowDownRightIcon className="size-3.5" aria-hidden />
          ) : (
            <ArrowUpRightIcon className="size-3.5" aria-hidden />
          )}
          <span className="font-medium tabular-nums">
            {formatNumber(change, lang, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" })}
          </span>
          <span>{vs_label}</span>
        </span>
      )}
    </div>
  );
}
