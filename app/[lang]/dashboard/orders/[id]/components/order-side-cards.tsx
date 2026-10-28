"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import type { AdminOrderDetail } from "@/app/actions/orders";
import { TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateInternalNote, useUpdateTracking } from "@/hooks/use-orders";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { canTransition } from "@/lib/orders";
import { update_tracking_schema } from "@/lib/schemas/orders";

type CardProps = {
  order: AdminOrderDetail;
  can_edit: boolean;
  dictionary: Dictionary["orders_admin"]["detail"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

export function TrackingCard({ order, can_edit, dictionary, common, errors }: CardProps) {
  const update_tracking = useUpdateTracking();
  const [carrier, setCarrier] = useState(order.carrier);
  const [tracking_number, setTrackingNumber] = useState(order.tracking_number);
  const [tracking_url, setTrackingUrl] = useState(order.tracking_url);
  const [is_url_invalid, setIsUrlInvalid] = useState(false);
  const can_ship = canTransition(order.status, "shipped");

  function save(is_mark_shipped: boolean) {
    const parsed = update_tracking_schema.safeParse({
      id: order.id,
      carrier,
      tracking_number,
      tracking_url: tracking_url.trim(),
      is_mark_shipped,
    });
    setIsUrlInvalid(!parsed.success);
    if (!parsed.success) return;
    update_tracking.mutate(parsed.data, {
      onSuccess: () => toast.success(is_mark_shipped ? dictionary.updated : dictionary.tracking_saved),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.tracking}</CardTitle>
        <CardDescription>{order.shipping_method}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            <TextField
              name="carrier"
              id="tracking-carrier"
              label={dictionary.carrier}
              value={carrier}
              disabled={!can_edit}
              onChange={(event) => setCarrier(event.target.value)}
            />
            <TextField
              name="tracking_number"
              id="tracking-number"
              label={dictionary.tracking_number}
              value={tracking_number}
              disabled={!can_edit}
              onChange={(event) => setTrackingNumber(event.target.value)}
            />
            <TextField
              name="tracking_url"
              id="tracking-url"
              type="url"
              label={dictionary.tracking_url}
              value={tracking_url}
              disabled={!can_edit}
              error={is_url_invalid ? errors.invalid_input : undefined}
              onChange={(event) => setTrackingUrl(event.target.value)}
            />
          </FieldGroup>
          {can_edit && (
            <div className="flex flex-wrap gap-2">
              {can_ship && (
                <Button type="button" size="sm" onClick={() => save(true)} disabled={update_tracking.isPending}>
                  {update_tracking.isPending && <Spinner aria-label={common.loading} />}
                  {dictionary.save_and_ship}
                </Button>
              )}
              <Button type="submit" size="sm" variant="outline" disabled={update_tracking.isPending}>
                {dictionary.save_tracking}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function InternalNoteCard({ order, can_edit, dictionary, common, errors }: CardProps) {
  const update_note = useUpdateInternalNote();
  const [note, setNote] = useState(order.internal_note);
  const is_dirty = note !== order.internal_note;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.internal_note}</CardTitle>
        <CardDescription>{dictionary.internal_note_hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label htmlFor="internal-note" className="sr-only">
          {dictionary.internal_note}
        </label>
        <Textarea
          id="internal-note"
          rows={3}
          value={note}
          maxLength={5000}
          disabled={!can_edit}
          onChange={(event) => setNote(event.target.value)}
        />
        {can_edit && is_dirty && (
          <Button
            size="sm"
            className="self-end"
            disabled={update_note.isPending}
            onClick={() =>
              update_note.mutate(
                { id: order.id, internal_note: note },
                {
                  onSuccess: () => toast.success(dictionary.saved),
                  onError: (error) => toast.error(errorText(errors, error)),
                },
              )
            }
          >
            {update_note.isPending && <Spinner aria-label={common.loading} />}
            {dictionary.save}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
