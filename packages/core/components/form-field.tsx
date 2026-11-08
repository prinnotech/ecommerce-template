import type { ComponentProps, ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";

export type FieldControlProps = {
  id: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
};

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  description?: string;
  // Shown next to the label, e.g. "optional".
  optional_label?: string;
  children: (control: FieldControlProps) => ReactNode;
};

// Label, control, description and error wired together for screen readers.
export function FormField({ id, label, error, description, optional_label, children }: FormFieldProps) {
  const description_id = description ? `${id}-description` : undefined;
  const error_id = error ? `${id}-error` : undefined;
  const described_by = [description_id, error_id].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional_label && <span className="text-muted-foreground font-normal">({optional_label})</span>}
      </FieldLabel>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": described_by })}
      {description && <FieldDescription id={description_id}>{description}</FieldDescription>}
      {error && <FieldError id={error_id}>{error}</FieldError>}
    </Field>
  );
}

type TextFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  label: string;
  id?: string;
  error?: string;
  description?: string;
  optional_label?: string;
};

export function TextField({ name, label, id, error, description, optional_label, ...input_props }: TextFieldProps) {
  return (
    <FormField
      id={id ?? `field-${name}`}
      label={label}
      error={error}
      description={description}
      optional_label={optional_label}
    >
      {(control) => <Input name={name} {...control} {...input_props} />}
    </FormField>
  );
}
