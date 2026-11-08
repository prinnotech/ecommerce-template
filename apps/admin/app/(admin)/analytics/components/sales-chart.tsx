"use client";

import { useState, type PointerEvent } from "react";

import type { AnalyticsPoint, Bucket } from "@repo/core/lib/analytics";

const WIDTH = 800;
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };

type SalesChartProps = {
  points: AnalyticsPoint[];
  metric: "sales" | "orders";
  bucket: Bucket;
  lang: string;
  formatValue: (value: number) => string;
  labels: { current: string; previous: string; chart: string };
};

// "14:00", "7 Nov", "Nov 2026": bucket keys are local dates, formatted without shifting zones.
export function bucketLabel(key: string, bucket: Bucket, lang: string): string {
  if (bucket === "hour") return `${key.slice(11, 13)}:00`;
  const date = new Date(`${bucket === "month" ? `${key}-01` : key}T00:00:00Z`);
  return new Intl.DateTimeFormat(lang, {
    timeZone: "UTC",
    ...(bucket === "month" ? { month: "short", year: "numeric" } : { day: "numeric", month: "short" }),
  }).format(date);
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((step) => step * magnitude).find((step) => step >= value) ?? value;
}

// One measure over time: this period as a line with a soft fill, the previous period dashed.
// Hover (or touch) shows both values for that bucket.
export function SalesChart({ points, metric, bucket, lang, formatValue, labels }: SalesChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const previous_key = metric === "sales" ? "previous_sales" : "previous_orders";
  const max = niceMax(Math.max(0, ...points.flatMap((point) => [point[metric], point[previous_key]])));
  const inner_width = WIDTH - PAD.left - PAD.right;
  const inner_height = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (points.length <= 1 ? inner_width / 2 : (index / (points.length - 1)) * inner_width);
  const y = (value: number) => PAD.top + inner_height - (value / max) * inner_height;
  const path = (key: "sales" | "orders" | "previous_sales" | "previous_orders") =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`)
      .join(" ");
  const area = `${path(metric)} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const label_every = Math.max(1, Math.ceil(points.length / 8));
  const active_point = active === null ? null : points[active];

  function onPointer(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const svg_x = ((event.clientX - box.left) / box.width) * WIDTH;
    const ratio = (svg_x - PAD.left) / inner_width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={labels.chart}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {formatValue(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          index % label_every === 0 ? (
            <text
              key={point.key}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {bucketLabel(point.key, bucket, lang)}
            </text>
          ) : null,
        )}
        <path d={area} className="fill-primary/10" />
        <path
          d={path(previous_key)}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <path d={path(metric)} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />
        {active_point && active !== null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + inner_height}
              className="stroke-muted-foreground"
            />
            <circle
              cx={x(active)}
              cy={y(active_point[metric])}
              r={4}
              className="fill-primary stroke-background"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {active_point && active !== null && (
        <div
          className="bg-popover pointer-events-none absolute top-2 z-10 flex min-w-36 -translate-x-1/2 flex-col gap-0.5 rounded-md border px-3 py-2 text-xs shadow-md"
          style={{ left: `${(x(active) / WIDTH) * 100}%` }}
          role="status"
        >
          <span className="font-medium">{bucketLabel(active_point.key, bucket, lang)}</span>
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">{labels.current}</span>
            <span className="tabular-nums">{formatValue(active_point[metric])}</span>
          </span>
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">{labels.previous}</span>
            <span className="tabular-nums">{formatValue(active_point[previous_key])}</span>
          </span>
        </div>
      )}
      <div className="text-muted-foreground mt-2 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-primary inline-block h-0.5 w-4" aria-hidden />
          {labels.current}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-muted-foreground inline-block w-4 border-t border-dashed" aria-hidden />
          {labels.previous}
        </span>
      </div>
    </div>
  );
}
