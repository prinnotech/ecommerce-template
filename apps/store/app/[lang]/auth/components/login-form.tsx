"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField, TextField } from "@repo/core/components/form-field";
import { PasswordInput } from "@repo/core/components/password-input";
import { Button } from "@repo/ui/components/ui/button";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useSignIn } from "@repo/core/hooks/use-auth";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { sign_in_schema } from "@repo/core/lib/schemas/auth";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";

type LoginFormProps = {
  lang: string;
  next_path: string;
  dictionary: Dictionary["auth"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
  loading_label: string;
};

export function LoginForm({ lang, next_path, dictionary, errors, validation, loading_label }: LoginFormProps) {
  const router = useRouter();
  const sign_in = useSignIn();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = sign_in_schema.safeParse({ email: form_data.get("email"), password: form_data.get("password") });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    sign_in.mutate(parsed.data, {
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
        <TextField
          name="email"
          type="email"
          label={dictionary.login.email}
          autoComplete="email"
          error={error("email")}
          required
        />
        <FormField id="field-password" label={dictionary.login.password} error={error("password")}>
          {(control) => (
            <PasswordInput
              name="password"
              autoComplete="current-password"
              required
              show_label={dictionary.password_input.show}
              hide_label={dictionary.password_input.hide}
              {...control}
            />
          )}
        </FormField>
        <Link
          href={`/${lang}/auth/reset-password`}
          className="text-muted-foreground hover:text-foreground -mt-2 text-sm underline-offset-4 hover:underline"
        >
          {dictionary.login.forgot_password}
        </Link>
        <Button type="submit" size="lg" disabled={sign_in.isPending}>
          {sign_in.isPending && <Spinner aria-label={loading_label} />}
          {dictionary.login.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
