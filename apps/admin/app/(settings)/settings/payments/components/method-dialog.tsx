"use client";

import { useState, type FormEvent } from "react";

import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { PaymentMethodConfig } from "@repo/core/lib/schemas/payments";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";

type MethodDialogProps = {
  method: PaymentMethodConfig | null;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  onSave: (method: PaymentMethodConfig) => void;
  lang: string;
  currency: string;
  dictionary: AdminDictionary["payments"];
  common: AdminDictionary["common"];
};

// Name, instructions and fee of one method. Changes go into the list; the page's Save stores them.
export function MethodDialog(props: MethodDialogProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {props.method && <MethodForm key={props.method.id} {...props} method={props.method} />}
      </DialogContent>
    </Dialog>
  );
}

function MethodForm({
  method,
  onOpenChange,
  onSave,
  lang,
  currency,
  dictionary,
  common,
}: MethodDialogProps & { method: PaymentMethodConfig }) {
  const [draft, setDraft] = useState(method);
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const has_name = Object.values(draft.name).some((text) => (text ?? "").trim());
  const has_fee = draft.type !== "stripe";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!has_name || Number.isNaN(draft.fee)) return;
    onSave(draft);
    onOpenChange(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{dictionary.types[method.type]}</DialogTitle>
        <DialogDescription>{dictionary.edit_hint[method.type]}</DialogDescription>
      </DialogHeader>
      <Field data-invalid={has_name ? undefined : true}>
        <FieldLabel htmlFor="method-name">{dictionary.name}</FieldLabel>
        <LocalizedFields
          id="method-name"
          label={dictionary.name}
          value={draft.name}
          onChange={(name) => setDraft({ ...draft, name })}
          lang={lang}
          status_labels={status_labels}
          invalid={!has_name}
        />
      </Field>
      {draft.type !== "stripe" && (
        <Field>
          <FieldLabel htmlFor="method-instructions">{dictionary.instructions}</FieldLabel>
          <LocalizedFields
            id="method-instructions"
            label={dictionary.instructions}
            value={draft.instructions}
            onChange={(instructions) => setDraft({ ...draft, instructions })}
            lang={lang}
            status_labels={status_labels}
            multiline
            rows={4}
          />
          <FieldDescription>{dictionary.instructions_hint[method.type]}</FieldDescription>
        </Field>
      )}
      {has_fee && (
        <Field>
          <FieldLabel htmlFor="method-fee">{dictionary.fee}</FieldLabel>
          <MoneyInput
            id="method-fee"
            cents={draft.fee}
            onChange={(fee) => setDraft({ ...draft, fee })}
            currency={currency}
            lang={lang}
            invalid={Number.isNaN(draft.fee)}
            className="w-40"
          />
          <FieldDescription>{dictionary.fee_hint}</FieldDescription>
        </Field>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {common.cancel}
        </Button>
        <Button type="submit" disabled={!has_name || Number.isNaN(draft.fee)}>
          {dictionary.apply}
        </Button>
      </DialogFooter>
    </form>
  );
}
