"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import type { Address } from "@/app/actions/account";
import { FormField, TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useCreateAddress, useUpdateAddress } from "@/hooks/use-account";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { countryOptions } from "@/lib/locale/countries";
import { address_schema } from "@/lib/schemas/account";
import { fieldErrors, type FieldErrors } from "@/lib/schemas/validation";

type AddressFormDialogProps = {
  lang: string;
  address: Address | null;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: Dictionary["account"]["addresses"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function AddressFormDialog({
  lang,
  address,
  is_open,
  onOpenChange,
  dictionary,
  common,
  errors,
  validation,
}: AddressFormDialogProps) {
  const create_address = useCreateAddress();
  const update_address = useUpdateAddress();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const is_pending = create_address.isPending || update_address.isPending;
  const form = dictionary.form;
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const countries = countryOptions(lang);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const text = (name: string) => String(form_data.get(name) ?? "");
    const parsed = address_schema.safeParse({
      full_name: text("full_name"),
      phone: text("phone"),
      line1: text("line1"),
      line2: text("line2"),
      city: text("city"),
      region: text("region"),
      postal_code: text("postal_code"),
      country: text("country"),
      is_default: form_data.get("is_default") === "on",
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    const callbacks = {
      onSuccess: () => {
        toast.success(dictionary.saved);
        onOpenChange(false);
      },
      onError: (mutation_error: Error) => toast.error(errorText(errors, mutation_error)),
    };
    if (address) update_address.mutate({ ...parsed.data, id: address.id }, callbacks);
    else create_address.mutate(parsed.data, callbacks);
  }

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" closeLabel={common.close}>
        <DialogHeader>
          <DialogTitle>{address ? dictionary.edit_title : dictionary.add_title}</DialogTitle>
          <DialogDescription className="sr-only">
            {address ? dictionary.edit_title : dictionary.add_title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            <FormField id="field-country" label={form.country} error={error("country")}>
              {(control) => (
                <NativeSelect
                  name="country"
                  defaultValue={address?.country ?? ""}
                  autoComplete="country"
                  className="w-full"
                  {...control}
                >
                  <NativeSelectOption value="" disabled>
                    {form.select_country}
                  </NativeSelectOption>
                  {countries.map((country) => (
                    <NativeSelectOption key={country.code} value={country.code}>
                      {country.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <TextField
              name="full_name"
              label={form.full_name}
              autoComplete="name"
              defaultValue={address?.full_name}
              error={error("full_name")}
              required
            />
            <TextField
              name="line1"
              label={form.line1}
              autoComplete="address-line1"
              defaultValue={address?.line1}
              error={error("line1")}
              required
            />
            <TextField
              name="line2"
              label={form.line2}
              optional_label={common.optional}
              autoComplete="address-line2"
              defaultValue={address?.line2}
              error={error("line2")}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                name="postal_code"
                label={form.postal_code}
                autoComplete="postal-code"
                defaultValue={address?.postal_code}
                error={error("postal_code")}
              />
              <TextField
                name="city"
                label={form.city}
                autoComplete="address-level2"
                defaultValue={address?.city}
                error={error("city")}
                required
              />
              <TextField
                name="region"
                label={form.region}
                autoComplete="address-level1"
                defaultValue={address?.region}
                error={error("region")}
              />
            </div>
            <TextField
              name="phone"
              type="tel"
              label={form.phone}
              optional_label={common.optional}
              autoComplete="tel"
              defaultValue={address?.phone}
              error={error("phone")}
            />
            <Field orientation="horizontal">
              <input
                id="field-is_default"
                name="is_default"
                type="checkbox"
                defaultChecked={address?.is_default ?? false}
                className="accent-primary size-4"
              />
              <FieldLabel htmlFor="field-is_default" className="font-normal">
                {form.is_default}
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common.cancel}
            </Button>
            <Button type="submit" disabled={is_pending}>
              {is_pending && <Spinner aria-label={common.loading} />}
              {form.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
