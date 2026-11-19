"use client";

import { FormField, TextField } from "@repo/core/components/form-field";
import { CARRIERS, findCarrier, trackingUrlFor } from "@repo/core/lib/fulfillment";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";

export type TrackingValue = { carrier: string; tracking_number: string; tracking_url: string };

// "" = no carrier, "other" = a carrier typed by name (with its own link), else a known carrier id.
export function carrierChoice(carrier: string): string {
  return findCarrier(carrier)?.id ?? (carrier ? "other" : "");
}

type CarrierFieldsProps = {
  id_prefix: string;
  value: TrackingValue;
  // Kept apart from the value so picking "Other" shows the name field before a name is typed.
  choice: string;
  onChoiceChange: (choice: string) => void;
  onChange: (value: TrackingValue) => void;
  is_url_invalid: boolean;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  errors: AdminDictionary["errors"];
};

// Carrier, tracking number and link. Known carriers build the link from the number; any other
// carrier is typed by name, with the link pasted by hand.
export function CarrierFields({
  id_prefix,
  value,
  choice,
  onChoiceChange,
  onChange,
  is_url_invalid,
  dictionary,
  errors,
}: CarrierFieldsProps) {
  const is_other = choice === "other";
  const link = is_other ? "" : trackingUrlFor(value.carrier, value.tracking_number);

  return (
    <>
      <FormField id={`${id_prefix}-carrier`} label={dictionary.carrier}>
        {(control) => (
          <NativeSelect
            {...control}
            value={choice}
            className="w-full"
            onChange={(event) => {
              const next = event.target.value;
              const known = CARRIERS.find((carrier) => carrier.id === next);
              onChoiceChange(next);
              onChange({ ...value, carrier: known?.name ?? "", tracking_url: "" });
            }}
          >
            <NativeSelectOption value="">{dictionary.carrier_none}</NativeSelectOption>
            {CARRIERS.map((carrier) => (
              <NativeSelectOption key={carrier.id} value={carrier.id}>
                {carrier.name}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="other">{dictionary.carrier_other}</NativeSelectOption>
          </NativeSelect>
        )}
      </FormField>
      {is_other && (
        <TextField
          name="carrier_name"
          id={`${id_prefix}-carrier-name`}
          label={dictionary.carrier_name}
          value={value.carrier}
          maxLength={100}
          autoComplete="off"
          onChange={(event) => onChange({ ...value, carrier: event.target.value })}
        />
      )}
      <TextField
        name="tracking_number"
        id={`${id_prefix}-tracking-number`}
        label={dictionary.tracking_number}
        value={value.tracking_number}
        maxLength={100}
        autoComplete="off"
        onChange={(event) => onChange({ ...value, tracking_number: event.target.value })}
      />
      {is_other ? (
        <TextField
          name="tracking_url"
          id={`${id_prefix}-tracking-url`}
          type="url"
          label={dictionary.tracking_url}
          value={value.tracking_url}
          autoComplete="off"
          error={is_url_invalid ? errors.invalid_input : undefined}
          onChange={(event) => onChange({ ...value, tracking_url: event.target.value })}
        />
      ) : (
        link && (
          <p className="text-muted-foreground text-xs break-all">
            {dictionary.tracking_link_preview}{" "}
            <a href={link} target="_blank" rel="noreferrer" className="text-foreground hover:underline">
              {link}
            </a>
          </p>
        )
      )}
    </>
  );
}
