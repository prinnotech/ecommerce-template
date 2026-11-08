"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@repo/core/components/form-field";
import { PasswordInput } from "@repo/core/components/password-input";
import { Button } from "@repo/ui/components/ui/button";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useConfirmPasswordReset } from "@repo/core/hooks/use-auth";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { confirm_password_reset_schema } from "@repo/core/lib/schemas/auth";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";

type NewPasswordFormProps = {
  token: string;
  dictionary: AdminDictionary["auth"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
  loading_label: string;
};

export function NewPasswordForm({ token, dictionary, errors, validation, loading_label }: NewPasswordFormProps) {
  const router = useRouter();
  const confirm_reset = useConfirmPasswordReset();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const password_labels = { show_label: dictionary.password_input.show, hide_label: dictionary.password_input.hide };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = confirm_password_reset_schema.safeParse({
      token,
      password: form_data.get("password"),
      password_confirm: form_data.get("password_confirm"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    confirm_reset.mutate(parsed.data, {
      onSuccess: () => {
        router.replace(`/login?reset=1`);
        router.refresh();
      },
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormField id="field-password" label={dictionary.new_password.password} error={error("password")}>
          {(control) => (
            <PasswordInput name="password" autoComplete="new-password" required {...password_labels} {...control} />
          )}
        </FormField>
        <FormField
          id="field-password_confirm"
          label={dictionary.new_password.password_confirm}
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
        <Button type="submit" size="lg" disabled={confirm_reset.isPending}>
          {confirm_reset.isPending && <Spinner aria-label={loading_label} />}
          {dictionary.new_password.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
