"use client";

import { CircleCheckIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { isLocale } from "@repo/core/i18nConfig";
import { useSubscribeNewsletter } from "@repo/core/hooks/use-messages";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { newsletter_signup_schema } from "@repo/core/lib/schemas/contact";

type NewsletterFormProps = {
  id: string;
  lang: string;
  dictionary: Dictionary["newsletter"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function NewsletterForm({ id, lang, dictionary, errors, validation }: NewsletterFormProps) {
  const subscribe = useSubscribeNewsletter();
  const [error, setError] = useState("");
  const [is_done, setIsDone] = useState(false);
  const input_id = `${id}-email`;
  const error_id = `${id}-error`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = newsletter_signup_schema.safeParse({
      email: String(form_data.get("email") ?? ""),
      lang: isLocale(lang) ? lang : undefined,
      website: String(form_data.get("website") ?? ""),
    });
    if (!parsed.success) {
      setError(validation.invalid_email);
      return;
    }
    setError("");
    subscribe.mutate(parsed.data, {
      onSuccess: () => setIsDone(true),
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  if (is_done) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-sm font-medium">
        <CircleCheckIcon className="text-primary size-5" aria-hidden />
        {dictionary.success}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-md flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={input_id} className="sr-only">
          {dictionary.email_label}
        </label>
        <Input
          id={input_id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={dictionary.email_label}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? error_id : undefined}
          className="h-11 flex-1"
        />
        {/* Honeypot: hidden from people, filled in by bots. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <Button type="submit" className="h-11 px-6" disabled={subscribe.isPending}>
          {subscribe.isPending && <Spinner />}
          {dictionary.submit}
        </Button>
      </div>
      {error && (
        <p id={error_id} className="text-destructive text-left text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
