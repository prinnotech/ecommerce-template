"use client";

import { GiftIcon, TagIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

import { FloatingInput } from "./floating-field";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import type { PricedLine } from "@repo/core/lib/checkout/checkout-server";
import type { Totals } from "@repo/core/lib/checkout/pricing";
import type { Dictionary } from "@repo/core/lib/i18n";
import { formatCurrency } from "@repo/core/lib/utils/format";
import type { AppliedGiftCard } from "@repo/core/actions/checkout";

type OrderSummaryProps = {
  id_prefix: string;
  lines: PricedLine[];
  totals: Totals;
  currency: string;
  lang: string;
  tax_included: boolean;
  applied_code: string;
  gift_card: AppliedGiftCard | null;
  onRemoveGiftCard?: () => void;
  is_discount_invalid: boolean;
  is_quoting: boolean;
  // Not given for a draft order's invoice: its discount is fixed.
  // onApplied runs once the code is accepted, so the field can be cleared.
  onApplyDiscount?: (code: string, onApplied?: () => void) => void;
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
  gift_card,
  onRemoveGiftCard,
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
    if (code.trim()) onApplyDiscount?.(code.trim(), () => setCode(""));
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {lines.map((line, index) => (
          <li key={`${line.variant_id}:${index}`} className="flex items-center gap-4">
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
              <p className="text-sm font-medium break-words">{line.title}</p>
              {line.variant_label && <p className="text-muted-foreground text-xs">{line.variant_label}</p>}
            </div>
            <p className="text-sm tabular-nums">{money(line.line_total)}</p>
          </li>
        ))}
      </ul>

      {onApplyDiscount && (
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
      )}
      {gift_card && (
        <div className="-mt-3 flex">
          <span className="bg-muted flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium">
            <GiftIcon className="size-3.5" aria-hidden />
            {gift_card.masked}
            {onRemoveGiftCard && (
              <button
                type="button"
                aria-label={dictionary.remove_gift_card.replace("{code}", gift_card.masked)}
                onClick={onRemoveGiftCard}
                className="hover:text-foreground text-muted-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </span>
        </div>
      )}
      {onApplyDiscount && applied_code && (
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
        {/* Always a taxes line, like Shopify: a row when taxes are added on top (audit X9). */}
        {!tax_included && <Row label={dictionary.taxes} value={money(totals.tax_total)} />}
        <div className="flex items-baseline justify-between pt-3 text-base font-semibold">
          <dt>{dictionary.total}</dt>
          <dd className="flex items-baseline gap-2">
            {is_quoting && <Spinner aria-label={loading_label} className="size-3.5" />}
            <span className="text-muted-foreground text-xs font-normal">{currency}</span>
            <span className="text-xl tabular-nums">{money(totals.total)}</span>
          </dd>
        </div>
        {gift_card && (
          <>
            <Row label={dictionary.gift_card} value={`−${money(gift_card.amount)}`} />
            <div className="flex items-baseline justify-between text-base font-semibold">
              <dt>{dictionary.to_pay}</dt>
              <dd className="tabular-nums">{money(totals.total - gift_card.amount)}</dd>
            </div>
          </>
        )}
        {tax_included && (
          <p className="text-muted-foreground -mt-1 text-xs">
            {totals.tax_total > 0
              ? dictionary.taxes_included.replace("{amount}", money(totals.tax_total))
              : dictionary.taxes_included_prices}
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
