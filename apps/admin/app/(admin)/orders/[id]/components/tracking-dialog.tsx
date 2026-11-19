"use client";

import { useState } from "react";
import { toast } from "sonner";

import { CarrierFields, carrierChoice, type TrackingValue } from "./carrier-fields";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { useUpdateFulfillment, useUpdateTracking } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { findCarrier } from "@repo/core/lib/fulfillment";
import { update_fulfillment_schema, update_tracking_schema } from "@repo/core/lib/schemas/orders";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";

// What is being edited: one package, or an order shipped before packages (tracking on the order).
export type TrackingTarget = { kind: "package"; fulfillment_id: string; tracking: TrackingValue } | { kind: "order" };

type TrackingDialogProps = {
  order: AdminOrderDetail;
  // null = closed.
  target: TrackingTarget | null;
  onClose: () => void;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

export function TrackingDialog({ order, target, onClose, dictionary, common, errors }: TrackingDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(is_open) => !is_open && onClose()}>
      {target && (
        <TrackingForm
          order={order}
          target={target}
          onClose={onClose}
          dictionary={dictionary}
          common={common}
          errors={errors}
        />
      )}
    </Dialog>
  );
}

function TrackingForm({
  order,
  target,
  onClose,
  dictionary,
  common,
  errors,
}: Omit<TrackingDialogProps, "target"> & { target: TrackingTarget }) {
  const update_package = useUpdateFulfillment();
  const update_order = useUpdateTracking();
  const initial =
    target.kind === "package"
      ? target.tracking
      : { carrier: order.carrier, tracking_number: order.tracking_number, tracking_url: order.tracking_url };
  const [tracking, setTracking] = useState<TrackingValue>(initial);
  const [choice, setChoice] = useState(carrierChoice(initial.carrier));
  const [is_url_invalid, setIsUrlInvalid] = useState(false);
  const is_pending = update_package.isPending || update_order.isPending;
  const callbacks = {
    onSuccess: () => {
      onClose();
      toast.success(dictionary.updated);
    },
    onError: (error: Error) => toast.error(errorText(errors, error)),
  };

  function submit() {
    // Known carriers get their link rebuilt on the server from the number.
    const tracking_url = choice === "other" || !findCarrier(tracking.carrier) ? tracking.tracking_url.trim() : "";
    const fields = { carrier: tracking.carrier, tracking_number: tracking.tracking_number, tracking_url };
    if (target.kind === "package") {
      const parsed = update_fulfillment_schema.safeParse({
        id: order.id,
        fulfillment_id: target.fulfillment_id,
        ...fields,
      });
      setIsUrlInvalid(!parsed.success);
      if (parsed.success) update_package.mutate(parsed.data, callbacks);
      return;
    }
    const parsed = update_tracking_schema.safeParse({ id: order.id, ...fields, is_mark_shipped: false });
    setIsUrlInvalid(!parsed.success);
    if (parsed.success) update_order.mutate(parsed.data, callbacks);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{dictionary.edit_tracking}</DialogTitle>
      </DialogHeader>
      <FieldGroup className="gap-3">
        <CarrierFields
          id_prefix="tracking"
          value={tracking}
          choice={choice}
          onChoiceChange={setChoice}
          onChange={setTracking}
          is_url_invalid={is_url_invalid}
          dictionary={dictionary}
          errors={errors}
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={is_pending}>
          {common.cancel}
        </Button>
        <Button type="button" onClick={submit} disabled={is_pending}>
          {is_pending && <Spinner aria-label={common.loading} />}
          {dictionary.save_tracking}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
