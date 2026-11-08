"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@repo/core/components/form-field";
import { PasswordInput } from "@repo/core/components/password-input";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useChangePassword } from "@repo/core/hooks/use-account";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { change_password_schema } from "@repo/core/lib/schemas/account";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";

type PasswordFormProps = {
  dictionary: Dictionary["account"]["profile"];
  password_input: Dictionary["auth"]["password_input"];
  new_password_hint: string;
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function PasswordForm({
  dictionary,
  password_input,
  new_password_hint,
  common,
  errors,
  validation,
}: PasswordFormProps) {
  const change_password = useChangePassword();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const password_labels = { show_label: password_input.show, hide_label: password_input.hide };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_element = event.currentTarget;
    const form_data = new FormData(form_element);
    const parsed = change_password_schema.safeParse({
      old_password: form_data.get("old_password"),
      password: form_data.get("password"),
      password_confirm: form_data.get("password_confirm"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    change_password.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(dictionary.password_changed);
        form_element.reset();
      },
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.password_title}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <CardContent>
          <FieldGroup>
            <FormField id="field-old_password" label={dictionary.current_password} error={error("old_password")}>
              {(control) => (
                <PasswordInput
                  name="old_password"
                  autoComplete="current-password"
                  required
                  {...password_labels}
                  {...control}
                />
              )}
            </FormField>
            <FormField
              id="field-password"
              label={dictionary.new_password}
              description={new_password_hint}
              error={error("password")}
            >
              {(control) => (
                <PasswordInput name="password" autoComplete="new-password" required {...password_labels} {...control} />
              )}
            </FormField>
            <FormField
              id="field-password_confirm"
              label={dictionary.confirm_password}
              error={error("password_confirm")}
            >
              {(control) => (
                <PasswordInput
                  name="password_confirm"
                  autoComplete="new-password"
                  required
                  {...password_labels}
                  {...control}
                />
              )}
            </FormField>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="outline" disabled={change_password.isPending}>
            {change_password.isPending && <Spinner aria-label={common.loading} />}
            {dictionary.change_password}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
