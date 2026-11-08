"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { TextField } from "@repo/core/components/form-field";
import { useUpdateTracking } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { canTransition } from "@repo/core/lib/orders";
import { update_tracking_schema } from "@repo/core/lib/schemas/orders";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";

type FulfillDialogProps = {
  order: AdminOrderDetail;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// One dialog for both paths: "Fulfill" marks the order shipped (audit O2), "Edit tracking"
// on an already-fulfilled order just updates the carrier/tracking without a status change.
export function FulfillDialog({ order, is_open, onOpenChange, dictionary, common, errors }: FulfillDialogProps) {
  const update_tracking = useUpdateTracking();
  const [carrier, setCarrier] = useState(order.carrier);
  const [tracking_number, setTrackingNumber] = useState(order.tracking_number);
  const [tracking_url, setTrackingUrl] = useState(order.tracking_url);
  const [is_url_invalid, setIsUrlInvalid] = useState(false);
  const mark_shipped = canTransition(order.status, "shipped");

  function submit() {
    const parsed = update_tracking_schema.safeParse({
      id: order.id,
      carrier,
      tracking_number,
      tracking_url: tracking_url.trim(),
      is_mark_shipped: mark_shipped,
    });
    setIsUrlInvalid(!parsed.success);
    if (!parsed.success) return;
    update_tracking.mutate(parsed.data, {
      onSuccess: () => {
        onOpenChange(false);
        toast.success(dictionary.updated);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mark_shipped
              ? dictionary.fulfill_title.replace("{number}", String(order.order_number))
              : dictionary.tracking}
          </DialogTitle>
          {mark_shipped && <DialogDescription>{dictionary.fulfill_body}</DialogDescription>}
        </DialogHeader>
        <FieldGroup className="gap-3">
          <TextField
            name="carrier"
            id="fulfill-carrier"
            label={dictionary.carrier}
            value={carrier}
            autoComplete="off"
            onChange={(event) => setCarrier(event.target.value)}
          />
          <TextField
            name="tracking_number"
            id="fulfill-tracking-number"
            label={dictionary.tracking_number}
            value={tracking_number}
            autoComplete="off"
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
          <TextField
            name="tracking_url"
            id="fulfill-tracking-url"
            type="url"
            label={dictionary.tracking_url}
            value={tracking_url}
            autoComplete="off"
            error={is_url_invalid ? errors.invalid_input : undefined}
            onChange={(event) => setTrackingUrl(event.target.value)}
          />
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update_tracking.isPending}
          >
            {common.cancel}
          </Button>
          <Button type="button" onClick={submit} disabled={update_tracking.isPending}>
            {update_tracking.isPending && <Spinner aria-label={common.loading} />}
            {mark_shipped ? dictionary.fulfill : dictionary.save_tracking}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
