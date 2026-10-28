"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { SelectOption } from "./settings-screen";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n";
import type { ShippingRate } from "@/lib/site-settings";

type ShippingRatesEditorProps = {
  value: unknown;
  onChange: (value: ShippingRate[]) => void;
  is_disabled: boolean;
  locales: SelectOption[];
  currency: string;
  dictionary: Dictionary["settings"]["shipping_rates"];
};

// Each row keeps its price text locally (see MoneyInput); the parent receives cents.
type Row = { rate: ShippingRate; price_text: string };

function toRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return (value as ShippingRate[]).map((rate) => ({ rate, price_text: (rate.price / 100).toFixed(2) }));
}

function newRateId(): string {
  return `rate_${crypto.randomUUID().slice(0, 8)}`;
}

export function ShippingRatesEditor({
  value,
  onChange,
  is_disabled,
  locales,
  currency,
  dictionary,
}: ShippingRatesEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(value));

  function commit(next_rows: Row[]) {
    setRows(next_rows);
    onChange(next_rows.map((row) => row.rate));
  }

  function updateRow(index: number, patch: Partial<ShippingRate>, price_text?: string) {
    commit(
      rows.map((row, row_index) =>
        row_index === index ? { rate: { ...row.rate, ...patch }, price_text: price_text ?? row.price_text } : row,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => {
        const prefix = `shipping-${row.rate.id}`;
        return (
          <fieldset key={row.rate.id} className="flex flex-col gap-3 rounded-lg border p-4" disabled={is_disabled}>
            <legend className="sr-only">{dictionary.rate_legend.replace("{number}", String(index + 1))}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {locales.map((locale) => (
                <Field key={locale.value}>
                  <FieldLabel htmlFor={`${prefix}-name-${locale.value}`}>
                    {dictionary.name} ({locale.value.toUpperCase()})
                  </FieldLabel>
                  <Input
                    id={`${prefix}-name-${locale.value}`}
                    value={row.rate.name[locale.value as keyof ShippingRate["name"]] ?? ""}
                    onChange={(event) =>
                      updateRow(index, { name: { ...row.rate.name, [locale.value]: event.target.value } })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Field className="col-span-2 sm:col-span-1">
                <FieldLabel htmlFor={`${prefix}-price`}>{dictionary.price}</FieldLabel>
                <div className="relative">
                  <Input
                    id={`${prefix}-price`}
                    inputMode="decimal"
                    className="pr-14 tabular-nums"
                    value={row.price_text}
                    onChange={(event) => {
                      const amount = Number(event.target.value.replace(",", "."));
                      const cents =
                        event.target.value.trim() === "" || Number.isNaN(amount)
                          ? Number.NaN
                          : Math.round(amount * 100);
                      updateRow(index, { price: cents }, event.target.value);
                    }}
                  />
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                    {currency}
                  </span>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-min`}>{dictionary.min_days}</FieldLabel>
                <Input
                  id={`${prefix}-min`}
                  type="number"
                  min={0}
                  value={Number.isNaN(row.rate.min_days) ? "" : row.rate.min_days}
                  onChange={(event) => updateRow(index, { min_days: event.target.valueAsNumber })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-max`}>{dictionary.max_days}</FieldLabel>
                <Input
                  id={`${prefix}-max`}
                  type="number"
                  min={0}
                  value={Number.isNaN(row.rate.max_days) ? "" : row.rate.max_days}
                  onChange={(event) => updateRow(index, { max_days: event.target.valueAsNumber })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive col-span-2 justify-self-end sm:col-span-1"
                aria-label={dictionary.remove}
                disabled={rows.length <= 1}
                onClick={() => commit(rows.filter((_, row_index) => row_index !== index))}
              >
                <Trash2Icon />
              </Button>
            </div>
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={is_disabled}
        onClick={() =>
          commit([
            ...rows,
            { rate: { id: newRateId(), name: {}, price: 0, min_days: 2, max_days: 5 }, price_text: "0.00" },
          ])
        }
      >
        <PlusIcon />
        {dictionary.add}
      </Button>
    </div>
  );
}
