"use client";

import { useState } from "react";
import { toast } from "sonner";

import { CarrierFields, type TrackingValue } from "./carrier-fields";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { useCreateFulfillment } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import { unfulfilledQuantities } from "@repo/core/lib/fulfillment";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { create_fulfillment_schema } from "@repo/core/lib/schemas/orders";
import { formatPlural } from "@repo/core/lib/utils/format";
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
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";

type FulfillDialogProps = {
  lang: string;
  order: AdminOrderDetail;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// One package: how many of each waiting line go in it (all of them by default), the carrier and
// tracking, and whether the customer gets the shipping email. Rendered only while open, so each
// opening starts from what is left.
export function FulfillDialog({ lang, order, is_open, onOpenChange, dictionary, common, errors }: FulfillDialogProps) {
  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      {is_open && (
        <FulfillForm
          lang={lang}
          order={order}
          onDone={() => onOpenChange(false)}
          dictionary={dictionary}
          common={common}
          errors={errors}
        />
      )}
    </Dialog>
  );
}

function FulfillForm({
  lang,
  order,
  onDone,
  dictionary,
  common,
  errors,
}: Omit<FulfillDialogProps, "is_open" | "onOpenChange"> & { onDone: () => void }) {
  const create = useCreateFulfillment();
  const left = unfulfilledQuantities(order.items, order.fulfillments);
  const waiting = order.items.filter((item) => (left.get(item.id) ?? 0) > 0);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(waiting.map((item) => [item.id, left.get(item.id) ?? 0])),
  );
  const [tracking, setTracking] = useState<TrackingValue>({ carrier: "", tracking_number: "", tracking_url: "" });
  const [choice, setChoice] = useState("");
  const [is_notify, setIsNotify] = useState(true);
  const [is_url_invalid, setIsUrlInvalid] = useState(false);
  const count = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);

  function submit() {
    const parsed = create_fulfillment_schema.safeParse({
      id: order.id,
      lines: Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([item_id, quantity]) => ({ item_id, quantity })),
      carrier: tracking.carrier,
      tracking_number: tracking.tracking_number,
      tracking_url: choice === "other" ? tracking.tracking_url.trim() : "",
      is_notify,
    });
    setIsUrlInvalid(!parsed.success && parsed.error.issues.some((issue) => issue.path[0] === "tracking_url"));
    if (!parsed.success) return;
    create.mutate(parsed.data, {
      onSuccess: () => {
        onDone();
        toast.success(dictionary.package_created);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{dictionary.fulfill_title.replace("{number}", String(order.order_number))}</DialogTitle>
        <DialogDescription>{dictionary.fulfill_body}</DialogDescription>
      </DialogHeader>
      <ul className="-mx-1 max-h-64 divide-y overflow-y-auto px-1">
        {waiting.map((item) => {
          const max = left.get(item.id) ?? 0;
          return (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <Thumbnail src={item.image} alt={item.title} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.variant_label && <p className="text-muted-foreground text-xs">{item.variant_label}</p>}
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Input
                  type="number"
                  min={0}
                  max={max}
                  value={quantities[item.id] ?? 0}
                  aria-label={dictionary.quantity_to_ship.replace("{name}", item.title)}
                  className="w-16 text-right tabular-nums"
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [item.id]: Math.min(max, Math.max(0, Math.round(Number(event.target.value)) || 0)),
                    }))
                  }
                />
                <span className="text-muted-foreground tabular-nums">
                  {dictionary.of_left.replace("{count}", String(max))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <FieldGroup className="gap-3">
        <CarrierFields
          id_prefix="fulfill"
          value={tracking}
          choice={choice}
          onChoiceChange={setChoice}
          onChange={setTracking}
          is_url_invalid={is_url_invalid}
          dictionary={dictionary}
          errors={errors}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={is_notify} onCheckedChange={(checked) => setIsNotify(checked === true)} />
          {dictionary.notify_customer}
        </label>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={create.isPending}>
          {common.cancel}
        </Button>
        <Button type="button" onClick={submit} disabled={create.isPending || count === 0}>
          {create.isPending && <Spinner aria-label={common.loading} />}
          {formatPlural(count, dictionary.ship_items, lang)}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
