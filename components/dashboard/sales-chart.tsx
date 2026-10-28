"use client";

import { useState } from "react";

import type { DailySales } from "@/app/actions/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type SalesChartProps = {
  daily: DailySales[];
  currency: string;
  lang: string;
  labels: {
    description: string;
    orders: string;
    table_date: string;
    table_sales: string;
    table_orders: string;
    empty: string;
  };
};

const HEIGHT = 220;
// The SVG covers only the plot; the y-axis labels sit in a 4rem HTML gutter to its left.
const AXIS_WIDTH = 0;
const BOTTOM = 24;
const GRID_LINES = 4;

// Rounds the axis maximum up to 1, 2 or 5 × 10^n so gridline labels read cleanly.
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiplier) => multiplier * power >= value) ?? 10;
  return step * power;
}

// Single-series bar chart: one hue (the theme's primary token), thin bars with rounded
// tops, a 2px gap, recessive gridlines, a hover tooltip per bar and a table for screen readers.
export function SalesChart({ daily, currency, lang, labels }: SalesChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...daily.map((day) => day.sales)));
  const plot_height = HEIGHT - BOTTOM;
  const count = daily.length;
  const money = (cents: number) => formatCurrency(cents, currency, lang);
  const compactMoney = (cents: number) =>
    new Intl.NumberFormat(lang, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(
      cents / 100,
    );
  const date = (key: string) => formatDate(`${key}T12:00:00`, lang);
  const has_sales = daily.some((day) => day.sales > 0);
  // Show ~5 date labels whatever the range.
  const label_every = Math.max(1, Math.ceil(count / 5));
  const active_day = active === null ? null : daily[active];

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{labels.description}</figcaption>
      <div className="relative" onMouseLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 1000 ${HEIGHT}`}
          preserveAspectRatio="none"
          className="ml-16 h-[220px] w-[calc(100%-4rem)] overflow-visible"
          role="img"
          aria-label={labels.description}
        >
          {Array.from({ length: GRID_LINES + 1 }, (_, index) => {
            const y = plot_height - (plot_height * index) / GRID_LINES;
            return (
              <line
                key={index}
                x1={AXIS_WIDTH}
                x2={1000}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={index === 0 ? undefined : "3 3"}
              />
            );
          })}
          {daily.map((day, index) => {
            const slot = (1000 - AXIS_WIDTH) / count;
            const x = AXIS_WIDTH + slot * index;
            const bar_height = (day.sales / max) * plot_height;
            const bar_width = Math.max(slot - 2, 1);
            const radius = Math.min(4, bar_width / 2, bar_height);
            const top = plot_height - bar_height;
            return (
              <g key={day.date}>
                {bar_height > 0 && (
                  // Rounded top, square base anchored on the baseline.
                  <path
                    d={`M${x},${plot_height} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + bar_width - radius} Q${x + bar_width},${top} ${x + bar_width},${top + radius} V${plot_height} Z`}
                    className={active === null || active === index ? "fill-primary" : "fill-primary/40"}
                  />
                )}
                {/* Hit target: the full column, much larger than the bar itself. */}
                <rect
                  x={x}
                  y={0}
                  width={slot}
                  height={plot_height}
                  fill="transparent"
                  onMouseEnter={() => setActive(index)}
                />
              </g>
            );
          })}
        </svg>

        {/* Axis labels as HTML so they don't stretch with the SVG. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16">
          {Array.from({ length: GRID_LINES + 1 }, (_, index) => (
            <span
              key={index}
              className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px] tabular-nums"
              style={{ top: plot_height - (plot_height * index) / GRID_LINES }}
            >
              {compactMoney((max * index) / GRID_LINES)}
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 left-16 h-5">
          {daily.map((day, index) =>
            index % label_every === 0 ? (
              <span
                key={day.date}
                className="text-muted-foreground absolute -translate-x-1/2 text-[11px] whitespace-nowrap"
                style={{ left: `${((index + 0.5) / count) * 100}%` }}
              >
                {new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(
                  new Date(`${day.date}T12:00:00`),
                )}
              </span>
            ) : null,
          )}
        </div>

        {active_day && active !== null && (
          <div
            role="status"
            className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border px-3 py-2 text-xs shadow-md"
            style={{
              left: `calc(4rem + (100% - 4rem) * ${(active + 0.5) / count})`,
            }}
          >
            <p className="text-muted-foreground">{date(active_day.date)}</p>
            <p className="text-sm font-semibold tabular-nums">{money(active_day.sales)}</p>
            <p className="text-muted-foreground">{labels.orders.replace("{count}", String(active_day.orders))}</p>
          </div>
        )}

        {!has_sales && (
          <p className="text-muted-foreground absolute inset-0 flex items-center justify-center pl-16 text-sm">
            {labels.empty}
          </p>
        )}
      </div>

      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{labels.table_date}</th>
            <th scope="col">{labels.table_sales}</th>
            <th scope="col">{labels.table_orders}</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((day) => (
            <tr key={day.date}>
              <td>{date(day.date)}</td>
              <td>{money(day.sales)}</td>
              <td>{day.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
