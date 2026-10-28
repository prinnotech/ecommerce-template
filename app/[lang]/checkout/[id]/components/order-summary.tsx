"use client";

import { TagIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

import { FloatingInput } from "./floating-field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PricedLine } from "@/lib/checkout/checkout-server";
import type { Totals } from "@/lib/checkout/pricing";
import type { Dictionary } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/format";

type OrderSummaryProps = {
  id_prefix: string;
  lines: PricedLine[];
  totals: Totals;
  currency: string;
  lang: string;
  tax_included: boolean;
  applied_code: string;
  is_discount_invalid: boolean;
  is_quoting: boolean;
  onApplyDiscount: (code: string) => void;
  dictionary: Dictionary["checkout"];
  invalid_discount_label: string;
  loading_label: string;
};

export function OrderSummary({
  id_prefix,
  lines,
  totals,
  currency,
  lang,
  tax_included,
  applied_code,
  is_discount_invalid,
  is_quoting,
  onApplyDiscount,
  dictionary,
  invalid_discount_label,
  loading_label,
}: OrderSummaryProps) {
  const [code, setCode] = useState("");
  const money = (cents: number) => formatCurrency(cents, currency, lang);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim()) onApplyDiscount(code.trim());
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {lines.map((line) => (
          <li key={line.variant_id} className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="bg-background size-16 overflow-hidden rounded-lg border">
                {line.image ? (
                  <Image
                    src={line.image}
                    alt=""
                    width={64}
                    height={64}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="font-display text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[10px] leading-tight">
                    {line.title}
                  </span>
                )}
              </div>
              <span
                className="bg-muted-foreground text-background absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-xs font-medium"
                aria-label={dictionary.quantity.replace("{quantity}", String(line.quantity))}
              >
                {line.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.title}</p>
              {line.variant_label && <p className="text-muted-foreground text-xs">{line.variant_label}</p>}
            </div>
            <p className="text-sm tabular-nums">{money(line.line_total)}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="flex-1">
          <FloatingInput
            id={`${id_prefix}-discount`}
            label={dictionary.discount_placeholder}
            value={code}
            autoComplete="off"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            error={is_discount_invalid ? invalid_discount_label : undefined}
          />
        </div>
        <Button type="submit" variant="outline" className="h-12 px-5" disabled={!code.trim() || is_quoting}>
          {dictionary.apply}
        </Button>
      </form>
      {applied_code && (
        <div className="-mt-3 flex">
          <span className="bg-muted flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium">
            <TagIcon className="size-3.5" aria-hidden />
            {applied_code}
            <button
              type="button"
              aria-label={dictionary.remove_discount.replace("{code}", applied_code)}
              onClick={() => onApplyDiscount("")}
              className="hover:text-foreground text-muted-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        </div>
      )}

      <dl className="flex flex-col gap-2 text-sm">
        <Row label={dictionary.subtotal} value={money(totals.subtotal)} />
        {totals.discount_total > 0 && <Row label={dictionary.discount} value={`−${money(totals.discount_total)}`} />}
        <Row
          label={dictionary.shipping}
          value={totals.shipping_total === 0 ? dictionary.free : money(totals.shipping_total)}
        />
        {totals.cod_fee > 0 && <Row label={dictionary.cod_fee_label} value={money(totals.cod_fee)} />}
        {!tax_included && totals.tax_total > 0 && <Row label={dictionary.taxes} value={money(totals.tax_total)} />}
        <div className="flex items-baseline justify-between pt-3 text-base font-semibold">
          <dt>{dictionary.total}</dt>
          <dd className="flex items-baseline gap-2">
            {is_quoting && <Spinner aria-label={loading_label} className="size-3.5" />}
            <span className="text-muted-foreground text-xs font-normal">{currency}</span>
            <span className="text-xl tabular-nums">{money(totals.total)}</span>
          </dd>
        </div>
        {tax_included && totals.tax_total > 0 && (
          <p className="text-muted-foreground -mt-1 text-xs">
            {dictionary.taxes_included.replace("{amount}", money(totals.tax_total))}
          </p>
        )}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
