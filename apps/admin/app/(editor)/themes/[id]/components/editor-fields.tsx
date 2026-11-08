"use client";

import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { FormField } from "@repo/core/components/form-field";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { ThemeButton } from "@repo/core/lib/schemas/theme";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Switch } from "@repo/ui/components/ui/switch";

// Small controlled fields for the theme editor. Every change goes straight into the draft
// (autosaved), so there are no submit buttons.

export type EditorContext = {
  lang: string;
  is_disabled: boolean;
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  media: AdminDictionary["themes"]["editor"]["media"];
};

// Same rule as the schema: an absolute URL, a site path or nothing.
export function isUrlOrPath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed.startsWith("/") || /^https?:\/\/\S+$/.test(trimmed);
}

export function TextInputField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  is_url?: boolean;
  invalid_label?: string;
  // A <datalist> id with suggested values (store pages, categories).
  list?: string;
  context: EditorContext;
}) {
  const is_invalid = props.is_url ? !isUrlOrPath(props.value) : false;
  return (
    <FormField
      id={props.id}
      label={props.label}
      description={props.description}
      error={is_invalid ? props.invalid_label : undefined}
    >
      {(control) => (
        <Input
          {...control}
          value={props.value}
          disabled={props.context.is_disabled}
          onChange={(event) => props.onChange(event.target.value)}
          inputMode={props.is_url ? "url" : undefined}
          list={props.list}
        />
      )}
    </FormField>
  );
}

export function LocalizedField(props: {
  id: string;
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  description?: string;
  multiline?: boolean;
  context: EditorContext;
}) {
  const description_id = props.description ? `${props.id}-description` : undefined;
  return (
    <Field>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <LocalizedFields
        id={props.id}
        label={props.label}
        value={props.value}
        onChange={props.onChange}
        lang={props.context.lang}
        status_labels={{ filled: props.context.common.text_filled, missing: props.context.common.text_missing }}
        multiline={props.multiline}
        rows={5}
        disabled={props.context.is_disabled}
        aria-describedby={description_id}
      />
      {props.description && <FieldDescription id={description_id}>{props.description}</FieldDescription>}
    </Field>
  );
}

export function SelectField<T extends string>(props: {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  description?: string;
  context: EditorContext;
}) {
  return (
    <FormField id={props.id} label={props.label} description={props.description}>
      {(control) => (
        <NativeSelect
          {...control}
          value={props.value}
          disabled={props.context.is_disabled}
          className="w-full"
          onChange={(event) => {
            const next = props.options.find((option) => option.value === event.target.value);
            if (next) props.onChange(next.value);
          }}
        >
          {props.options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

export function NumberField(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  context: EditorContext;
}) {
  return (
    <FormField id={props.id} label={props.label}>
      {(control) => (
        <Input
          {...control}
          type="number"
          min={props.min}
          max={props.max}
          value={props.value}
          disabled={props.context.is_disabled}
          className="w-28"
          onChange={(event) => {
            const value = Math.round(Number(event.target.value));
            if (Number.isFinite(value)) props.onChange(Math.min(Math.max(value, props.min), props.max));
          }}
        />
      )}
    </FormField>
  );
}

export function SwitchField(props: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  context: EditorContext;
}) {
  const description_id = props.description ? `${props.id}-description` : undefined;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={props.id} className="text-sm font-medium">
          {props.label}
        </label>
        {props.description && (
          <p id={description_id} className="text-muted-foreground text-xs">
            {props.description}
          </p>
        )}
      </div>
      <Switch
        id={props.id}
        checked={props.checked}
        disabled={props.context.is_disabled}
        onCheckedChange={props.onChange}
        aria-describedby={description_id}
      />
    </div>
  );
}

export function ColorField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  context: EditorContext;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={props.id} className="text-sm">
        {props.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={props.id}
          type="color"
          value={props.value}
          disabled={props.context.is_disabled}
          onChange={(event) => props.onChange(event.target.value)}
          className="border-input size-8 cursor-pointer rounded-md border bg-transparent p-0.5 disabled:cursor-not-allowed"
        />
        {/* Uncontrolled so half-typed values stay in the box; re-keyed when the picker changes it. */}
        <Input
          aria-label={props.label}
          disabled={props.context.is_disabled}
          maxLength={7}
          className="w-24 font-mono text-xs uppercase"
          onChange={(event) => {
            const value = event.target.value.trim();
            // Only complete #rrggbb values reach the draft (the schema accepts nothing else).
            if (/^#[0-9a-f]{6}$/i.test(value)) props.onChange(value.toLowerCase());
          }}
          key={props.value}
          defaultValue={props.value}
        />
      </div>
    </div>
  );
}

export function ButtonFields(props: {
  id: string;
  label: string;
  value: ThemeButton;
  onChange: (value: ThemeButton) => void;
  labels: { label: string; href: string; hint: string; invalid: string };
  context: EditorContext;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{props.label}</legend>
      <LocalizedField
        id={`${props.id}-label`}
        label={props.labels.label}
        value={props.value.label}
        onChange={(label) => props.onChange({ ...props.value, label })}
        context={props.context}
      />
      <TextInputField
        id={`${props.id}-href`}
        label={props.labels.href}
        value={props.value.href}
        onChange={(href) => props.onChange({ ...props.value, href })}
        description={props.labels.hint}
        is_url
        invalid_label={props.labels.invalid}
        context={props.context}
      />
    </fieldset>
  );
}
