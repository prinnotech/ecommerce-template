"use client";

import { useState } from "react";
import { toast } from "sonner";

import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { useRefundOrder } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { splitRefund } from "@repo/core/lib/orders";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";

type RefundDialogProps = {
  lang: string;
  order: AdminOrderDetail;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: AdminDictionary["refund"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Pick items (and quantities) and/or type an amount. The amount follows the items until it's
// edited by hand; the server checks it again against what's left to refund.
export function RefundDialog(props: RefundDialogProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        {props.is_open && <RefundForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function RefundForm({ lang, order, onOpenChange, dictionary, common, errors }: RefundDialogProps) {
  const refund = useRefundOrder();
  const money = (cents: number) => formatCurrency(cents, order.currency, lang);
  const remaining = order.total - order.refunded_total;
  const refundedQuantity = (item_id: string) =>
    order.refunds
      .flatMap((entry) => entry.lines)
      .filter((line) => line.item_id === item_id)
      .reduce((sum, line) => sum + line.quantity, 0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [is_shipping, setIsShipping] = useState(false);
  const [manual_amount, setManualAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [is_restock, setIsRestock] = useState(order.status !== "cancelled");
  const [is_notify, setIsNotify] = useState(true);
  const is_card = order.payments.some((payment) => payment.provider === "stripe" && payment.status === "succeeded");

  const items_amount = order.items.reduce((sum, item) => sum + item.unit_price * (quantities[item.id] ?? 0), 0);
  const suggested = Math.min(remaining, items_amount + (is_shipping ? order.shipping_total : 0));
  const amount = manual_amount ?? suggested;
  const is_valid = Number.isInteger(amount) && amount >= 1 && amount <= remaining;
  // Same split as the server: money first, then back onto the gift card.
  const split = splitRefund(order, is_valid ? amount : 0);
  const lines = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([item_id, quantity]) => ({ item_id, quantity }));

  function submit() {
    if (!is_valid) return;
    refund.mutate(
      { id: order.id, amount, lines, reason, is_restock: is_restock && lines.length > 0, is_notify },
      {
        onSuccess: () => {
          toast.success(dictionary.done.replace("{amount}", money(amount)));
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{`${dictionary.title} · #${order.order_number}`}</DialogTitle>
        <DialogDescription>{is_card ? dictionary.card_note : dictionary.manual_note}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{dictionary.items}</p>
        <ul className="divide-y rounded-md border">
          {order.items.map((item) => {
            const left = item.quantity - refundedQuantity(item.id);
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <Thumbnail src={item.image} alt="" size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{item.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {[item.variant_label, `${money(item.unit_price)} × ${item.quantity}`].filter(Boolean).join(" · ")}
                    {left < item.quantity &&
                      ` · ${dictionary.already.replace("{count}", String(item.quantity - left))}`}
                  </span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={left}
                  disabled={left <= 0}
                  value={quantities[item.id] ?? 0}
                  aria-label={dictionary.quantity_for.replace("{name}", item.title)}
                  className="h-8 w-20 text-right tabular-nums"
                  onChange={(event) => {
                    const quantity = Math.max(0, Math.min(left, Math.round(Number(event.target.value)) || 0));
                    setQuantities((current) => ({ ...current, [item.id]: quantity }));
                    setManualAmount(null);
                  }}
                />
              </li>
            );
          })}
          {order.shipping_total > 0 && (
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={is_shipping}
                  onCheckedChange={(checked) => {
                    setIsShipping(checked === true);
                    setManualAmount(null);
                  }}
                />
                {dictionary.shipping}
              </label>
              <span className="tabular-nums">{money(order.shipping_total)}</span>
            </li>
          )}
        </ul>
      </div>

      <Field>
        <FieldLabel htmlFor="refund-amount">{dictionary.amount}</FieldLabel>
        <MoneyInput
          key={manual_amount === null ? `auto-${suggested}` : "manual"}
          id="refund-amount"
          cents={amount}
          onChange={setManualAmount}
          currency={order.currency}
          lang={lang}
          invalid={!is_valid}
          className="max-w-48"
        />
        <FieldDescription>{dictionary.amount_hint.replace("{max}", money(remaining))}</FieldDescription>
        {split.gift_card > 0 && (
          <FieldDescription>
            {dictionary.gift_card_split
              .replace("{gift_card}", money(split.gift_card))
              .replace("{money}", money(split.money))}
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="refund-reason">{dictionary.reason}</FieldLabel>
        <Textarea
          id="refund-reason"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2 text-sm">
        {order.status !== "cancelled" && (
          <label className="flex items-center gap-2">
            <Checkbox
              checked={is_restock}
              disabled={lines.length === 0}
              onCheckedChange={(checked) => setIsRestock(checked === true)}
            />
            {dictionary.restock}
          </label>
        )}
        <label className="flex items-center gap-2">
          <Checkbox checked={is_notify} onCheckedChange={(checked) => setIsNotify(checked === true)} />
          {dictionary.notify}
        </label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {common.cancel}
        </Button>
        <Button type="button" disabled={!is_valid || refund.isPending} onClick={submit}>
          {refund.isPending && <Spinner />}
          {dictionary.submit.replace("{amount}", is_valid ? money(amount) : "—")}
        </Button>
      </DialogFooter>
    </>
  );
}
