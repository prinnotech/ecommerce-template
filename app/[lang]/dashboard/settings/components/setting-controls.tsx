"use client";

import { useState } from "react";

import type { SelectOption } from "./settings-screen";
import { ShippingRatesEditor } from "./shipping-rates-editor";
import { MoneyInput } from "@/components/dashboard/money-input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import type { SettingInput } from "@/lib/site-settings";

type SettingControlProps = {
  id: string;
  label: string;
  input: SettingInput;
  value: unknown;
  default_value: unknown;
  onChange: (value: unknown) => void;
  is_disabled: boolean;
  is_invalid: boolean;
  select_options: SelectOption[];
  countries: SelectOption[];
  locales: SelectOption[];
  currency: string;
  lang: string;
  field_labels: Record<string, string>;
  dictionary: Dictionary["settings"];
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function SettingControl(props: SettingControlProps) {
  const { id, label, input, value, default_value, onChange, is_disabled, is_invalid } = props;
  const aria = { "aria-invalid": is_invalid || undefined };

  switch (input) {
    case "text":
    case "url":
      return (
        <Input
          id={id}
          aria-label={label}
          type={input === "url" ? "url" : "text"}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          disabled={is_disabled}
          {...aria}
        />
      );

    case "number":
      return (
        <Input
          id={id}
          aria-label={label}
          type="number"
          step="any"
          value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
          disabled={is_disabled}
          className="max-w-40 tabular-nums"
          {...aria}
        />
      );

    case "money":
      return (
        <div className="max-w-48">
          <MoneyInput
            id={id}
            aria-label={label}
            cents={typeof value === "number" ? value : Number.NaN}
            onChange={onChange}
            currency={props.currency}
            disabled={is_disabled}
            invalid={is_invalid}
          />
        </div>
      );

    case "boolean":
      return (
        <Switch
          id={id}
          aria-label={label}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={is_disabled}
        />
      );

    case "currency":
    case "timezone":
    case "locale":
      return (
        <NativeSelect
          id={id}
          aria-label={label}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          disabled={is_disabled}
          className="w-full max-w-sm"
          {...aria}
        >
          {props.select_options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      );

    case "object": {
      const record = asRecord(value);
      // Field list and types come from the default value, so the contract stays the single source.
      const fields = Object.entries(asRecord(default_value));
      const setField = (field: string, field_value: unknown) => onChange({ ...record, [field]: field_value });
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([field, field_default]) => {
            const field_id = `${id}-${field}`;
            const field_label = props.field_labels[field] ?? field;
            if (typeof field_default === "boolean") {
              return (
                <Field key={field} orientation="horizontal" className="sm:col-span-2">
                  <Switch
                    id={field_id}
                    checked={record[field] === true}
                    onCheckedChange={(checked) => setField(field, checked)}
                    disabled={is_disabled}
                  />
                  <FieldLabel htmlFor={field_id} className="font-normal">
                    {field_label}
                  </FieldLabel>
                </Field>
              );
            }
            return (
              <Field key={field}>
                <FieldLabel htmlFor={field_id}>{field_label}</FieldLabel>
                {field === "country" ? (
                  <NativeSelect
                    id={field_id}
                    value={asString(record[field])}
                    onChange={(event) => setField(field, event.target.value)}
                    disabled={is_disabled}
                    className="w-full"
                  >
                    <NativeSelectOption value="">—</NativeSelectOption>
                    {props.countries.map((country) => (
                      <NativeSelectOption key={country.value} value={country.value}>
                        {country.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={field_id}
                    value={asString(record[field])}
                    onChange={(event) => setField(field, event.target.value)}
                    disabled={is_disabled}
                  />
                )}
              </Field>
            );
          })}
        </div>
      );
    }

    case "localized_text": {
      const record = asRecord(value);
      return (
        <div className="flex flex-col gap-3">
          {props.locales.map((locale) => (
            <Field key={locale.value}>
              <FieldLabel htmlFor={`${id}-${locale.value}`}>{locale.label}</FieldLabel>
              <Input
                id={`${id}-${locale.value}`}
                value={asString(record[locale.value])}
                onChange={(event) => onChange({ ...record, [locale.value]: event.target.value })}
                disabled={is_disabled}
              />
            </Field>
          ))}
        </div>
      );
    }

    case "localized_long_text": {
      const record = asRecord(value);
      return (
        <Tabs defaultValue={props.locales[0]?.value} className="gap-2">
          <TabsList>
            {props.locales.map((locale) => (
              <TabsTrigger key={locale.value} value={locale.value}>
                {locale.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {props.locales.map((locale) => (
            <TabsContent key={locale.value} value={locale.value} className="flex flex-col gap-1.5">
              <Textarea
                aria-label={`${label} (${locale.label})`}
                rows={12}
                value={asString(record[locale.value])}
                onChange={(event) => onChange({ ...record, [locale.value]: event.target.value })}
                disabled={is_disabled}
              />
              <p className="text-muted-foreground text-xs">{props.dictionary.long_text_hint}</p>
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    case "shipping_rates":
      return (
        <ShippingRatesEditor
          value={value}
          onChange={onChange}
          is_disabled={is_disabled}
          locales={props.locales}
          currency={props.currency}
          dictionary={props.dictionary.shipping_rates}
        />
      );

    case "json":
      return <JsonInput id={id} label={label} value={value} onChange={onChange} is_disabled={is_disabled} />;
  }
}

function JsonInput({
  id,
  label,
  value,
  onChange,
  is_disabled,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  is_disabled: boolean;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  return (
    <Textarea
      id={id}
      aria-label={label}
      rows={8}
      className="font-mono text-xs"
      value={text}
      disabled={is_disabled}
      onChange={(event) => {
        setText(event.target.value);
        try {
          onChange(JSON.parse(event.target.value));
        } catch {
          // Not valid JSON yet: keep a value that fails the schema so Save stays disabled.
          onChange(Symbol.for("invalid-json"));
        }
      }}
    />
  );
}
