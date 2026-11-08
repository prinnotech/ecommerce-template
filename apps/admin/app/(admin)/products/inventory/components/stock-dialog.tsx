"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { variantLabel } from "./inventory-table";
import type { InventoryRow } from "@repo/core/backend/types";
import { useAdjustStock, useStockHistory } from "@repo/core/hooks/use-inventory";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { ADJUSTMENT_REASONS, adjust_stock_schema, type AdjustmentReason } from "@repo/core/lib/schemas/inventory";
import { formatDateTime } from "@repo/core/lib/utils/format";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";

type StockDialogProps = {
  row: InventoryRow | null;
  onOpenChange: (is_open: boolean) => void;
  title: string;
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["inventory"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Adjust one variant's stock with a reason, and see every past change.
export function StockDialog(props: StockDialogProps) {
  return (
    <Dialog open={props.row !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {props.row && <DialogBody key={props.row.variant_id} {...props} row={props.row} />}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  row,
  onOpenChange,
  title,
  lang,
  can_edit,
  dictionary,
  common,
  errors,
}: StockDialogProps & { row: InventoryRow }) {
  const adjust = useAdjustStock();
  const history = useStockHistory(row.variant_id);
  const [mode, setMode] = useState<"add" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("received");
  const [note, setNote] = useState("");
  const [stock, setStock] = useState(row.stock);

  const input = { variant_id: row.variant_id, mode, quantity: Number(quantity), reason, note };
  const parsed = adjust_stock_schema.safeParse(input);
  const is_valid = quantity.trim() !== "" && parsed.success;
  const preview = is_valid ? Math.max(0, mode === "set" ? input.quantity : stock + input.quantity) : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!is_valid || !parsed.success) return;
    adjust.mutate(parsed.data, {
      onSuccess: (result) => {
        setStock(result.stock);
        setQuantity("");
        setNote("");
        toast.success(dictionary.saved);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {variantLabel(row, dictionary.default_variant)}
          {row.sku && ` · ${row.sku}`}
        </DialogDescription>
      </DialogHeader>

      <p className="text-sm">
        {dictionary.current}: <span className="font-semibold tabular-nums">{stock}</span>
      </p>

      {can_edit && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="adjust-mode">{dictionary.mode}</FieldLabel>
              <NativeSelect
                id="adjust-mode"
                value={mode}
                className="w-full"
                onChange={(event) => setMode(event.target.value === "set" ? "set" : "add")}
              >
                <NativeSelectOption value="add">{dictionary.mode_add}</NativeSelectOption>
                <NativeSelectOption value="set">{dictionary.mode_set}</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="adjust-quantity">
                {mode === "add" ? dictionary.quantity_add : dictionary.quantity_set}
              </FieldLabel>
              <Input
                id="adjust-quantity"
                type="number"
                inputMode="numeric"
                min={mode === "set" ? 0 : undefined}
                value={quantity}
                placeholder={mode === "add" ? "+5 / -2" : String(stock)}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="adjust-reason">{dictionary.reason}</FieldLabel>
            <NativeSelect
              id="adjust-reason"
              value={reason}
              className="w-full"
              onChange={(event) => setReason(ADJUSTMENT_REASONS.find((item) => item === event.target.value) ?? "other")}
            >
              {ADJUSTMENT_REASONS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {dictionary.reasons[item]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="adjust-note">
              {dictionary.note} <span className="text-muted-foreground font-normal">({common.optional})</span>
            </FieldLabel>
            <Textarea
              id="adjust-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <DialogFooter className="items-center sm:justify-between">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {preview !== null && dictionary.new_stock.replace("{stock}", String(preview))}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {common.close}
              </Button>
              <Button type="submit" disabled={!is_valid || adjust.isPending}>
                {adjust.isPending && <Spinner />}
                {dictionary.save}
              </Button>
            </div>
          </DialogFooter>
        </form>
      )}

      <section className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-sm font-medium">{dictionary.history}</h3>
        {history.isPending ? (
          <Skeleton className="h-24 rounded-md" />
        ) : history.isError ? (
          <p className="text-destructive text-sm">{errorText(errors, history.error)}</p>
        ) : history.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">{dictionary.history_empty}</p>
        ) : (
          <ul className="divide-y text-sm">
            {history.data.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium tabular-nums", entry.delta < 0 && "text-destructive")}>
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                  <span>{dictionary.reasons[entry.reason] ?? entry.reason}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {dictionary.stock_after.replace("{stock}", String(entry.stock_after))}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(entry.created_at, lang)}
                  {entry.actor_name && ` · ${entry.actor_name}`}
                </p>
                {entry.note && <p className="text-xs">{entry.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
