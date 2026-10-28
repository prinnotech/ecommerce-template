"use client";

import { CircleCheckIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField, TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitContactMessage } from "@/hooks/use-messages";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { contact_message_schema } from "@/lib/schemas/contact";
import { fieldErrors, type FieldErrors } from "@/lib/schemas/validation";

type ContactFormProps = {
  dictionary: Dictionary["contact"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function ContactForm({ dictionary, common, errors, validation }: ContactFormProps) {
  const submit = useSubmitContactMessage();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const [sent_to, setSentTo] = useState<{ name: string; email: string } | null>(null);
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const form_data = new FormData(form);
    const value = (name: string) => String(form_data.get(name) ?? "");
    const parsed = contact_message_schema.safeParse({
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      subject: value("subject"),
      message: value("message"),
      website: value("website"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    submit.mutate(parsed.data, {
      onSuccess: () => {
        setSentTo({ name: parsed.data.name, email: parsed.data.email });
        form.reset();
      },
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  if (sent_to) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-xl border p-8">
        <CircleCheckIcon className="text-primary size-8" strokeWidth={1.5} aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">{dictionary.sent_title}</p>
          <p className="text-muted-foreground">
            {dictionary.sent_body.replace("{name}", sent_to.name).replace("{email}", sent_to.email)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setSentTo(null)}>
          {dictionary.send_another}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label={dictionary.name} autoComplete="name" error={error("name")} required />
          <TextField
            name="email"
            type="email"
            label={dictionary.email_label}
            autoComplete="email"
            error={error("email")}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="phone"
            type="tel"
            label={dictionary.phone_label}
            optional_label={common.optional}
            autoComplete="tel"
            error={error("phone")}
          />
          <TextField
            name="subject"
            label={dictionary.subject}
            optional_label={common.optional}
            error={error("subject")}
          />
        </div>
        <FormField
          id="field-message"
          label={dictionary.message}
          description={dictionary.order_hint}
          error={error("message")}
        >
          {(control) => <Textarea name="message" rows={6} maxLength={5000} required {...control} />}
        </FormField>
        {/* Honeypot: off-screen and skipped by keyboard and screen readers; bots fill it in. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label htmlFor="field-website">{dictionary.website}</label>
          <input id="field-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <Button type="submit" size="lg" className="h-12 self-start px-8" disabled={submit.isPending}>
          {submit.isPending && <Spinner aria-label={common.loading} />}
          {dictionary.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
