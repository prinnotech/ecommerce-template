"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@repo/core/components/form-field";
import { useAddDomain } from "@repo/core/hooks/use-domains";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { add_domain_schema, DOMAIN_TARGETS, type DomainTarget } from "@repo/core/lib/schemas/domains";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";

type AddDomainDialogProps = {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  // Opens with this app chosen (the card the button was in).
  default_target: DomainTarget;
  // The new domain's id, so its DNS records can be shown right away.
  onAdded: (id: string) => void;
  dictionary: AdminDictionary["domains"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

export function AddDomainDialog({
  is_open,
  onOpenChange,
  default_target,
  onAdded,
  dictionary,
  common,
  errors,
  validation,
}: AddDomainDialogProps) {
  const add_domain = useAddDomain();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = add_domain_schema.safeParse({
      hostname: form_data.get("hostname"),
      target: form_data.get("target"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    add_domain.mutate(parsed.data, {
      onSuccess: (domain) => {
        toast.success(dictionary.added);
        onOpenChange(false);
        onAdded(domain.id);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  const hostname_error = field_errors.hostname ? validation[field_errors.hostname] : undefined;

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" closeLabel={common.close}>
        <DialogHeader>
          <DialogTitle>{dictionary.add_title}</DialogTitle>
          <DialogDescription>{dictionary.add_body}</DialogDescription>
        </DialogHeader>
        {/* key: a fresh form (and default app) every time the dialog opens. */}
        <form key={`${is_open}-${default_target}`} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField id="domain-hostname" label={dictionary.hostname} error={hostname_error}>
            {(control) => (
              <Input
                {...control}
                name="hostname"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={dictionary.hostname_placeholder}
                autoFocus
              />
            )}
          </FormField>
          <FormField id="domain-target" label={dictionary.target}>
            {(control) => (
              <NativeSelect {...control} name="target" defaultValue={default_target} className="w-full">
                {DOMAIN_TARGETS.map((target) => (
                  <NativeSelectOption key={target} value={target}>
                    {dictionary.targets[target]} · {dictionary.target_hint[target]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={add_domain.isPending}>
              {common.cancel}
            </Button>
            <Button type="submit" disabled={add_domain.isPending}>
              {add_domain.isPending && <Spinner aria-hidden />}
              {dictionary.add_submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
