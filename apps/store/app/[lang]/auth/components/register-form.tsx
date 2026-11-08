"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField, TextField } from "@repo/core/components/form-field";
import { PasswordInput } from "@repo/core/components/password-input";
import { Button } from "@repo/ui/components/ui/button";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useSignUp } from "@repo/core/hooks/use-auth";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { sign_up_schema } from "@repo/core/lib/schemas/auth";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";

type RegisterFormProps = {
  next_path: string;
  dictionary: Dictionary["auth"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
  loading_label: string;
};

export function RegisterForm({ next_path, dictionary, errors, validation, loading_label }: RegisterFormProps) {
  const router = useRouter();
  const sign_up = useSignUp();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const password_labels = { show_label: dictionary.password_input.show, hide_label: dictionary.password_input.hide };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = sign_up_schema.safeParse({
      name: form_data.get("name"),
      email: form_data.get("email"),
      password: form_data.get("password"),
      password_confirm: form_data.get("password_confirm"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    sign_up.mutate(parsed.data, {
      onSuccess: () => {
        router.replace(next_path);
        router.refresh();
      },
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField name="name" label={dictionary.register.name} autoComplete="name" error={error("name")} required />
        <TextField
          name="email"
          type="email"
          label={dictionary.register.email}
          autoComplete="email"
          error={error("email")}
          required
        />
        <FormField
          id="field-password"
          label={dictionary.register.password}
          description={dictionary.register.password_hint}
          error={error("password")}
        >
          {(control) => (
            <PasswordInput name="password" autoComplete="new-password" required {...password_labels} {...control} />
          )}
        </FormField>
        <FormField
          id="field-password_confirm"
          label={dictionary.register.password_confirm}
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
        <Button type="submit" size="lg" disabled={sign_up.isPending}>
          {sign_up.isPending && <Spinner aria-label={loading_label} />}
          {dictionary.register.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
