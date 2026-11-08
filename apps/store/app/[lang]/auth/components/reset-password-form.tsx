"use client";

import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { TextField } from "@repo/core/components/form-field";
import { Button } from "@repo/ui/components/ui/button";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useRequestPasswordReset } from "@repo/core/hooks/use-auth";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { request_password_reset_schema } from "@repo/core/lib/schemas/auth";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";

type ResetPasswordFormProps = {
  lang: string;
  dictionary: Dictionary["auth"]["reset_password"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
  loading_label: string;
};

export function ResetPasswordForm({ lang, dictionary, errors, validation, loading_label }: ResetPasswordFormProps) {
  const request_reset = useRequestPasswordReset();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const [sent_to, setSentTo] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = request_password_reset_schema.safeParse({ email: form_data.get("email") });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    request_reset.mutate(parsed.data, {
      onSuccess: () => setSentTo(parsed.data.email),
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  if (sent_to) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center">
        <MailCheckIcon className="text-muted-foreground size-8" aria-hidden />
        <p className="font-medium">{dictionary.sent_title}</p>
        <p className="text-muted-foreground text-sm">{dictionary.sent_body.replace("{email}", sent_to)}</p>
        <Link href={`/${lang}/auth/login`} className="text-sm font-medium underline-offset-4 hover:underline">
          {dictionary.back_to_login}
        </Link>
      </div>
    );
  }

  const email_error = field_errors.email ? validation[field_errors.email] : undefined;

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          name="email"
          type="email"
          label={dictionary.email}
          autoComplete="email"
          error={email_error}
          required
        />
        <Button type="submit" size="lg" disabled={request_reset.isPending}>
          {request_reset.isPending && <Spinner aria-label={loading_label} />}
          {dictionary.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
