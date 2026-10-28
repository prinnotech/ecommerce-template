"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MoneyInputProps = {
  id: string;
  // Integer cents. NaN while the text isn't a valid amount (so validation fails).
  cents: number;
  onChange: (cents: number) => void;
  currency: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

function toText(cents: number): string {
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : "";
}

// Edited in major units, stored in cents. The text is kept locally so half-typed
// values ("12.") don't jump around while typing.
export function MoneyInput({ id, cents, onChange, currency, disabled, invalid, className, ...aria }: MoneyInputProps) {
  const [text, setText] = useState(() => toText(cents));

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="pr-14 tabular-nums"
        onChange={(event) => {
          const next_text = event.target.value;
          setText(next_text);
          const amount = Number(next_text.replace(",", "."));
          onChange(next_text.trim() === "" || Number.isNaN(amount) ? Number.NaN : Math.round(amount * 100));
        }}
        onBlur={() => Number.isFinite(cents) && setText(toText(cents))}
        {...aria}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
        {currency}
      </span>
    </div>
  );
}
