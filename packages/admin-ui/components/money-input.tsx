"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";

type MoneyInputProps = {
  id: string;
  // Integer cents. NaN while the text isn't a valid amount (so validation fails).
  cents: number;
  onChange: (cents: number) => void;
  currency: string;
  lang: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

// "90,99" in Italian and Spanish, "90.99" in English (audit A5). No thousands separator while editing.
function toText(cents: number, lang: string): string {
  if (!Number.isFinite(cents)) return "";
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(
    cents / 100,
  );
}

// Accepts either separator: the last "," or "." is the decimal point, earlier ones are grouping.
export function parseMoney(text: string): number {
  const trimmed = text.replace(/\s/g, "");
  if (trimmed === "" || !/^-?[\d.,]+$/.test(trimmed)) return Number.NaN;
  const last_separator = Math.max(trimmed.lastIndexOf(","), trimmed.lastIndexOf("."));
  const normalized =
    last_separator === -1
      ? trimmed
      : `${trimmed.slice(0, last_separator).replace(/[.,]/g, "")}.${trimmed.slice(last_separator + 1)}`;
  const amount = Number(normalized);
  return Number.isNaN(amount) ? Number.NaN : Math.round(amount * 100);
}

function currencySymbol(currency: string, lang: string): string {
  const part = new Intl.NumberFormat(lang, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
    .formatToParts(0)
    .find((entry) => entry.type === "currency");
  return part?.value ?? currency;
}

// Edited in major units, stored in cents. The text is kept locally so half-typed values ("12,")
// don't jump around while typing; it is reformatted on blur.
export function MoneyInput({
  id,
  cents,
  onChange,
  currency,
  lang,
  disabled,
  invalid,
  className,
  ...aria
}: MoneyInputProps) {
  const [text, setText] = useState(() => toText(cents, lang));

  return (
    <div className={cn("relative", className)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        {currencySymbol(currency, lang)}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="pl-8 tabular-nums"
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseMoney(event.target.value));
        }}
        onBlur={() => Number.isFinite(cents) && setText(toText(cents, lang))}
        {...aria}
      />
    </div>
  );
}
