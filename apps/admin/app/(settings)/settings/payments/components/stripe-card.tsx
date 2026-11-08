"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { PaymentsOverview } from "@repo/core/actions/payments";
import { FormField } from "@repo/core/components/form-field";
import { useSaveStripeKeys } from "@repo/core/hooks/use-payments";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";

type StripeCardProps = {
  overview: PaymentsOverview;
  can_edit: boolean;
  dictionary: AdminDictionary["payments"];
  errors: AdminDictionary["errors"];
};

// The Stripe connection. Secret keys are write-only: the page only knows whether each is set.
export function StripeCard({ overview, can_edit, dictionary, errors }: StripeCardProps) {
  const text = dictionary.stripe;
  const save = useSaveStripeKeys();
  const { stripe } = overview;
  const [publishable_key, setPublishableKey] = useState(stripe.publishable_key);
  const [secret_key, setSecretKey] = useState("");
  const [webhook_secret, setWebhookSecret] = useState("");
  const [is_copied, setIsCopied] = useState(false);

  const secretHint = (status: PaymentsOverview["stripe"]["secret_key"]) =>
    status.is_from_env ? text.from_env : status.is_set ? text.saved_hint : text.not_set;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(
      {
        publishable_key: publishable_key.trim(),
        // Empty boxes keep what's saved.
        secret_key: secret_key.trim() || undefined,
        webhook_secret: webhook_secret.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSecretKey("");
          setWebhookSecret("");
          toast.success(text.saved);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <SectionCard
      title={text.title}
      description={text.description}
      action={
        stripe.is_ready ? (
          <StatusBadge tone="success">{text.connected}</StatusBadge>
        ) : (
          <StatusBadge tone="attention">{text.not_connected}</StatusBadge>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {!overview.can_store_secrets && (
          <p className="bg-warning text-warning-foreground rounded-md px-3 py-2 text-sm">{text.encryption_missing}</p>
        )}
        <FormField id="stripe-publishable" label={text.publishable_key} description={text.publishable_hint}>
          {(control) => (
            <Input
              {...control}
              value={publishable_key}
              onChange={(event) => setPublishableKey(event.target.value)}
              placeholder="pk_test_…"
              disabled={!can_edit}
              className="font-mono text-xs"
            />
          )}
        </FormField>
        <FormField id="stripe-secret" label={text.secret_key} description={secretHint(stripe.secret_key)}>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="off"
              value={secret_key}
              onChange={(event) => setSecretKey(event.target.value)}
              placeholder={stripe.secret_key.is_set ? "••••••••" : "sk_test_…"}
              disabled={!can_edit || !overview.can_store_secrets}
              className="font-mono text-xs"
            />
          )}
        </FormField>
        <div className="bg-muted/50 flex flex-col gap-2 rounded-md p-3 text-sm">
          <p className="font-medium">{text.webhook_title}</p>
          <p className="text-muted-foreground text-xs">{text.webhook_steps}</p>
          <div className="flex items-center gap-2">
            <code className="bg-background flex-1 truncate rounded border px-2 py-1.5 text-xs">
              {stripe.webhook_url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={text.copy}
              onClick={() => {
                void navigator.clipboard.writeText(stripe.webhook_url).then(() => {
                  setIsCopied(true);
                  window.setTimeout(() => setIsCopied(false), 1500);
                });
              }}
            >
              {is_copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {text.webhook_events} <code>checkout.session.completed</code>,{" "}
            <code>checkout.session.async_payment_succeeded</code>
          </p>
        </div>
        <FormField id="stripe-webhook" label={text.webhook_secret} description={secretHint(stripe.webhook_secret)}>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="off"
              value={webhook_secret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder={stripe.webhook_secret.is_set ? "••••••••" : "whsec_…"}
              disabled={!can_edit || !overview.can_store_secrets}
              className="font-mono text-xs"
            />
          )}
        </FormField>
        {can_edit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              {text.save}
            </Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}
