"use client";

import { SendIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { EmailSendingOverview } from "@repo/core/actions/emails";
import { FormField } from "@repo/core/components/form-field";
import { useEmailSending, useSaveSmtp, useSendSmtpTest } from "@repo/core/hooks/use-emails";
import { errorText } from "@repo/core/lib/action-result";
import { smtp_schema, SMTP_SECURITY, type SmtpSettings } from "@repo/core/lib/email/templates";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type EmailSendingScreenProps = {
  can_edit: boolean;
  staff_email: string;
  dictionary: AdminDictionary["email_sending"];
  errors: AdminDictionary["errors"];
};

// The usual port for each kind of encryption, filled in when it changes.
const DEFAULT_PORT = { starttls: 587, tls: 465, none: 25 } as const;

export function EmailSendingScreen(props: EmailSendingScreenProps) {
  const sending = useEmailSending();
  if (sending.isPending) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <Skeleton className="h-80 rounded-xl" />
      </Page>
    );
  }
  if (sending.isError) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(props.errors, sending.error)}</p>
      </Page>
    );
  }
  return <SmtpForm key={JSON.stringify(sending.data.smtp)} {...props} overview={sending.data} />;
}

function SmtpForm({
  can_edit,
  staff_email,
  dictionary,
  errors,
  overview,
}: EmailSendingScreenProps & { overview: EmailSendingOverview }) {
  const save = useSaveSmtp();
  const test = useSendSmtpTest();
  const [smtp, setSmtp] = useState<SmtpSettings>(overview.smtp);
  const [password, setPassword] = useState("");
  const [test_to, setTestTo] = useState(staff_email);
  const set = (patch: Partial<SmtpSettings>) => setSmtp((current) => ({ ...current, ...patch }));
  const parsed = smtp_schema.safeParse(smtp);
  const is_disabled = !can_edit;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    save.mutate(
      { smtp: parsed.data, password: password || undefined },
      {
        onSuccess: () => {
          setPassword("");
          toast.success(dictionary.saved);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="narrow"
      title_meta={
        overview.is_configured ? (
          <StatusBadge tone="success">{dictionary.configured}</StatusBadge>
        ) : (
          <StatusBadge tone="attention">{dictionary.not_configured}</StatusBadge>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <SectionCard title={dictionary.server_title} description={dictionary.server_hint}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <FormField id="smtp-host" label={dictionary.host}>
              {(control) => (
                <Input
                  {...control}
                  value={smtp.host}
                  disabled={is_disabled}
                  placeholder="smtp.example.com"
                  onChange={(event) => set({ host: event.target.value })}
                />
              )}
            </FormField>
            <FormField id="smtp-port" label={dictionary.port}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  max={65535}
                  value={smtp.port}
                  disabled={is_disabled}
                  onChange={(event) => set({ port: Math.round(Number(event.target.value)) || 0 })}
                />
              )}
            </FormField>
          </div>
          <FormField id="smtp-security" label={dictionary.security}>
            {(control) => (
              <NativeSelect
                {...control}
                value={smtp.security}
                disabled={is_disabled}
                className="w-full"
                onChange={(event) => {
                  const security = SMTP_SECURITY.find((item) => item === event.target.value) ?? "starttls";
                  set({ security, port: DEFAULT_PORT[security] });
                }}
              >
                {SMTP_SECURITY.map((security) => (
                  <NativeSelectOption key={security} value={security}>
                    {dictionary.security_options[security]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="smtp-username" label={dictionary.username}>
              {(control) => (
                <Input
                  {...control}
                  value={smtp.username}
                  autoComplete="off"
                  disabled={is_disabled}
                  onChange={(event) => set({ username: event.target.value })}
                />
              )}
            </FormField>
            <FormField
              id="smtp-password"
              label={dictionary.password}
              description={
                overview.password.is_from_env
                  ? dictionary.password_env
                  : overview.password.is_set
                    ? dictionary.password_saved
                    : dictionary.password_not_set
              }
            >
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  placeholder={overview.password.is_set ? "••••••••" : ""}
                  disabled={is_disabled || !overview.can_store_secrets}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </FormField>
          </div>
          {!overview.can_store_secrets && (
            <p className="bg-warning text-warning-foreground rounded-md px-3 py-2 text-sm">
              {dictionary.encryption_missing}
            </p>
          )}
        </SectionCard>

        <SectionCard title={dictionary.sender_title} description={dictionary.sender_hint}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="smtp-from-name" label={dictionary.from_name}>
              {(control) => (
                <Input
                  {...control}
                  value={smtp.from_name}
                  disabled={is_disabled}
                  onChange={(event) => set({ from_name: event.target.value })}
                />
              )}
            </FormField>
            <FormField id="smtp-from-email" label={dictionary.from_email}>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  value={smtp.from_email}
                  disabled={is_disabled}
                  placeholder="shop@example.com"
                  onChange={(event) => set({ from_email: event.target.value.trim() })}
                />
              )}
            </FormField>
          </div>
        </SectionCard>

        {can_edit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending || !parsed.success}>
              {save.isPending && <Spinner />}
              {dictionary.save}
            </Button>
          </div>
        )}
      </form>

      {can_edit && (
        <SectionCard title={dictionary.test_title} description={dictionary.test_hint}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="smtp-test-to" className="sr-only">
              {dictionary.test_to}
            </label>
            <Input
              id="smtp-test-to"
              type="email"
              value={test_to}
              onChange={(event) => setTestTo(event.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={test.isPending || !overview.is_configured}
              onClick={() =>
                test.mutate(test_to, {
                  onSuccess: () => toast.success(dictionary.test_sent.replace("{email}", test_to)),
                  onError: (error) => toast.error(errorText(errors, error)),
                })
              }
            >
              {test.isPending ? <Spinner /> : <SendIcon />}
              {dictionary.test_send}
            </Button>
          </div>
        </SectionCard>
      )}
    </Page>
  );
}
