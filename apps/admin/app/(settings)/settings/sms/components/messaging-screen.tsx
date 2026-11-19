"use client";

import { PlusIcon, SendIcon, XIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { MessageLogCard } from "./message-log-card";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { MessagingOverview } from "@repo/core/actions/messaging";
import { FormField } from "@repo/core/components/form-field";
import { useMessaging, useSaveMessaging, useSendMessagingTest } from "@repo/core/hooks/use-messaging";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import {
  EVENT_PLACEHOLDERS,
  MESSAGE_EVENTS,
  MESSAGE_PLACEHOLDERS,
  messageEventSettings,
  messaging_schema,
  STAFF_MESSAGE_EVENTS,
  type MessageEvent,
  type MessageEventSettings,
  type MessagePlaceholder,
  type MessagingSettings,
} from "@repo/core/lib/schemas/messaging";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";

type Dictionary = AdminDictionary["sms_settings"];

type MessagingScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: Dictionary;
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

type FieldErrorKey = keyof Dictionary["field_errors"];

export function MessagingScreen(props: MessagingScreenProps) {
  const messaging = useMessaging();
  if (messaging.isPending) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <Skeleton className="h-96 rounded-xl" />
      </Page>
    );
  }
  if (messaging.isError) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(props.errors, messaging.error)}</p>
      </Page>
    );
  }
  return <MessagingForm key={JSON.stringify(messaging.data.settings)} {...props} overview={messaging.data} />;
}

// Zod issues by field path ("events.order_shipped.whatsapp_content_sid"), as dictionary keys.
function fieldErrors(settings: MessagingSettings, dictionary: Dictionary): Record<string, string> {
  const parsed = messaging_schema.safeParse(settings);
  if (parsed.success) return {};
  const result: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".");
    const key = issue.message in dictionary.field_errors ? (issue.message as FieldErrorKey) : null;
    result[path] ??= key ? dictionary.field_errors[key] : issue.message;
  }
  return result;
}

function MessagingForm({
  lang,
  can_edit,
  dictionary,
  common,
  errors,
  overview,
}: MessagingScreenProps & { overview: MessagingOverview }) {
  const save = useSaveMessaging();
  const [settings, setSettings] = useState<MessagingSettings>(overview.settings);
  const [auth_token, setAuthToken] = useState("");
  const [staff_text, setStaffText] = useState(overview.settings.staff_phones.join("\n"));
  const [open_event, setOpenEvent] = useState<MessageEvent | null>(null);
  const [is_submitted, setIsSubmitted] = useState(false);
  const is_disabled = !can_edit;

  const set = (patch: Partial<MessagingSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const setEvent = (event: MessageEvent, patch: Partial<MessageEventSettings>) =>
    setSettings((current) => ({
      ...current,
      events: { ...current.events, [event]: { ...messageEventSettings(current, event), ...patch } },
    }));

  const staff_phones = staff_text
    .split(/[\n,;]+/)
    .map((phone) => phone.replace(/[\s().-]/g, ""))
    .filter(Boolean);
  const draft: MessagingSettings = { ...settings, staff_phones };
  const field_errors = fieldErrors(draft, dictionary);
  const shown_errors = is_submitted ? field_errors : {};
  const staff_error = Object.entries(shown_errors).find(([path]) => path.startsWith("staff_phones"))?.[1];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
    const parsed = messaging_schema.safeParse(draft);
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    save.mutate(
      { settings: parsed.data, auth_token: auth_token || undefined },
      {
        onSuccess: () => {
          setAuthToken("");
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
        <SectionCard title={dictionary.account_title} description={dictionary.account_hint}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="twilio-account-sid" label={dictionary.account_sid} error={shown_errors.account_sid}>
              {(control) => (
                <Input
                  {...control}
                  value={settings.account_sid}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={is_disabled}
                  placeholder="AC…"
                  onChange={(event) => set({ account_sid: event.target.value.trim() })}
                />
              )}
            </FormField>
            <FormField
              id="twilio-auth-token"
              label={dictionary.auth_token}
              description={
                overview.auth_token.is_from_env
                  ? dictionary.token_env
                  : overview.auth_token.is_set
                    ? dictionary.token_saved
                    : dictionary.token_not_set
              }
            >
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="new-password"
                  value={auth_token}
                  placeholder={overview.auth_token.is_set ? "••••••••" : ""}
                  disabled={is_disabled || !overview.can_store_secrets || overview.auth_token.is_from_env}
                  onChange={(event) => setAuthToken(event.target.value)}
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

        <SectionCard title={dictionary.senders_title}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="twilio-sms-from"
              label={dictionary.sms_from}
              description={dictionary.sms_from_hint}
              error={shown_errors.sms_from}
            >
              {(control) => (
                <Input
                  {...control}
                  value={settings.sms_from}
                  disabled={is_disabled}
                  placeholder="+15551234567"
                  onChange={(event) => set({ sms_from: event.target.value.replace(/\s/g, "") })}
                />
              )}
            </FormField>
            <FormField
              id="twilio-whatsapp-from"
              label={dictionary.whatsapp_from}
              description={dictionary.whatsapp_from_hint}
              error={shown_errors.whatsapp_from}
            >
              {(control) => (
                <Input
                  {...control}
                  value={settings.whatsapp_from}
                  disabled={is_disabled}
                  placeholder="+14155238886"
                  onChange={(event) => set({ whatsapp_from: event.target.value.replace(/\s/g, "") })}
                />
              )}
            </FormField>
          </div>
          <FormField
            id="twilio-country-code"
            label={dictionary.country_code}
            description={dictionary.country_code_hint}
            error={shown_errors.default_country_code}
          >
            {(control) => (
              <Input
                {...control}
                value={settings.default_country_code}
                disabled={is_disabled}
                placeholder="+39"
                className="sm:w-32"
                onChange={(event) => set({ default_country_code: event.target.value.replace(/\s/g, "") })}
              />
            )}
          </FormField>
        </SectionCard>

        <SectionCard title={dictionary.staff_title}>
          <FormField
            id="twilio-staff-phones"
            label={dictionary.staff_phones}
            description={dictionary.staff_hint}
            error={staff_error}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                value={staff_text}
                disabled={is_disabled}
                placeholder="+393331234567"
                onChange={(event) => setStaffText(event.target.value)}
              />
            )}
          </FormField>
        </SectionCard>

        <SectionCard title={dictionary.events_title} description={dictionary.events_hint} is_flush>
          <ul className="divide-y">
            {MESSAGE_EVENTS.map((event) => (
              <EventRow
                key={event}
                event={event}
                config={messageEventSettings(settings, event)}
                is_open={open_event === event}
                onToggleOpen={() => setOpenEvent((current) => (current === event ? null : event))}
                onChange={(patch) => setEvent(event, patch)}
                errors={shown_errors}
                lang={lang}
                is_disabled={is_disabled}
                dictionary={dictionary}
                common={common}
              />
            ))}
          </ul>
        </SectionCard>

        {can_edit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              {dictionary.save}
            </Button>
          </div>
        )}
      </form>

      {can_edit && <TestCard is_configured={overview.is_configured} dictionary={dictionary} errors={errors} />}
      <MessageLogCard lang={lang} dictionary={dictionary} common={common} errors={errors} />
    </Page>
  );
}

type EventRowProps = {
  event: MessageEvent;
  config: MessageEventSettings;
  is_open: boolean;
  onToggleOpen: () => void;
  onChange: (patch: Partial<MessageEventSettings>) => void;
  errors: Record<string, string>;
  lang: string;
  is_disabled: boolean;
  dictionary: Dictionary;
  common: AdminDictionary["common"];
};

// One event: its two switches, and (opened) the SMS text per language and the WhatsApp template.
function EventRow({
  event,
  config,
  is_open,
  onToggleOpen,
  onChange,
  errors,
  lang,
  is_disabled,
  dictionary,
  common,
}: EventRowProps) {
  const text = dictionary.events[event];
  const is_staff = STAFF_MESSAGE_EVENTS.includes(event);
  const sms_length = localized(config.sms_text, lang).length;
  const content_error = errors[`events.${event}.whatsapp_content_sid`];
  const placeholder_list = EVENT_PLACEHOLDERS[event].map((name) => `{{${name}}}`).join(" ");

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 basis-full flex-col gap-0.5 sm:flex-1 sm:basis-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {text.label}
            <StatusBadge tone={is_staff ? "info" : "neutral"} has_dot={false}>
              {is_staff ? dictionary.audience_staff : dictionary.audience_customer}
            </StatusBadge>
          </p>
          <p className="text-muted-foreground text-xs">{text.description}</p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={config.sms}
            disabled={is_disabled}
            aria-label={dictionary.toggle_sms.replace("{event}", text.label)}
            onCheckedChange={(checked) => onChange({ sms: checked })}
          />
          {dictionary.channel_sms}
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={config.whatsapp}
            disabled={is_disabled}
            aria-label={dictionary.toggle_whatsapp.replace("{event}", text.label)}
            onCheckedChange={(checked) => onChange({ whatsapp: checked })}
          />
          {dictionary.channel_whatsapp}
        </label>
        <Button type="button" variant="ghost" size="sm" aria-expanded={is_open} onClick={onToggleOpen}>
          {is_open ? dictionary.done : dictionary.edit}
        </Button>
      </div>
      {config.whatsapp && !config.whatsapp_content_sid && (
        <p className="text-warning-foreground bg-warning rounded-md px-3 py-1.5 text-xs">
          {dictionary.whatsapp_needs_template}
        </p>
      )}

      {is_open && (
        <div className="bg-muted/40 flex flex-col gap-4 rounded-lg p-3">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{dictionary.sms_text}</p>
            <LocalizedFields
              id={`sms-text-${event}`}
              label={dictionary.sms_text}
              value={config.sms_text}
              onChange={(sms_text) => onChange({ sms_text })}
              lang={lang}
              status_labels={{ filled: common.text_filled, missing: common.text_missing }}
              multiline
              rows={3}
              disabled={is_disabled}
            />
            <p className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
              <span className="font-mono">{dictionary.placeholders.replace("{list}", placeholder_list)}</span>
              <span>
                {dictionary.characters
                  .replace("{count}", String(sms_length))
                  .replace("{parts}", String(sms_length <= 160 ? 1 : Math.ceil(sms_length / 153)))}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{dictionary.whatsapp_title}</p>
              <p className="text-muted-foreground text-xs">{dictionary.whatsapp_hint}</p>
            </div>
            <FormField id={`content-sid-${event}`} label={dictionary.content_sid} error={content_error}>
              {(control) => (
                <Input
                  {...control}
                  value={config.whatsapp_content_sid}
                  disabled={is_disabled}
                  spellCheck={false}
                  placeholder="HX…"
                  onChange={(change) => onChange({ whatsapp_content_sid: change.target.value.trim() })}
                />
              )}
            </FormField>
            <VariablesEditor
              event={event}
              variables={config.whatsapp_variables}
              onChange={(whatsapp_variables) => onChange({ whatsapp_variables })}
              is_disabled={is_disabled}
              dictionary={dictionary}
            />
          </div>
        </div>
      )}
    </li>
  );
}

// {{1}}, {{2}}… of a WhatsApp template, each filled with a placeholder.
function VariablesEditor({
  event,
  variables,
  onChange,
  is_disabled,
  dictionary,
}: {
  event: MessageEvent;
  variables: MessagePlaceholder[];
  onChange: (variables: MessagePlaceholder[]) => void;
  is_disabled: boolean;
  dictionary: Dictionary;
}) {
  const suggested = EVENT_PLACEHOLDERS[event];
  const options = [...suggested, ...MESSAGE_PLACEHOLDERS.filter((name) => !suggested.includes(name))];
  const replace = (index: number, value: string) => {
    const name = MESSAGE_PLACEHOLDERS.find((item) => item === value);
    if (name) onChange(variables.map((current, position) => (position === index ? name : current)));
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{dictionary.variables}</legend>
      <p className="text-muted-foreground text-xs">{dictionary.variables_hint}</p>
      {variables.map((name, index) => {
        const label = dictionary.variable_label.replace("{n}", String(index + 1));
        return (
          <div key={index} className="flex items-center gap-2">
            <span className="text-muted-foreground w-24 shrink-0 font-mono text-xs">{`{{${index + 1}}}`}</span>
            <NativeSelect
              aria-label={label}
              value={name}
              disabled={is_disabled}
              className="w-full"
              onChange={(change) => replace(index, change.target.value)}
            >
              {options.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {dictionary.placeholder_names[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={is_disabled}
              aria-label={dictionary.remove_variable.replace("{n}", String(index + 1))}
              onClick={() => onChange(variables.filter((_, position) => position !== index))}
            >
              <XIcon />
            </Button>
          </div>
        );
      })}
      {variables.length < 10 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={is_disabled}
          onClick={() => onChange([...variables, suggested[variables.length] ?? suggested[0] ?? "store_name"])}
        >
          <PlusIcon />
          {dictionary.add_variable}
        </Button>
      )}
    </fieldset>
  );
}

function TestCard({
  is_configured,
  dictionary,
  errors,
}: {
  is_configured: boolean;
  dictionary: Dictionary;
  errors: AdminDictionary["errors"];
}) {
  const test = useSendMessagingTest();
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [to, setTo] = useState("");

  return (
    <SectionCard title={dictionary.test_title} description={dictionary.test_hint}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="sms-test-channel" className="sr-only">
          {dictionary.test_channel}
        </label>
        <NativeSelect
          id="sms-test-channel"
          value={channel}
          className="sm:w-36"
          onChange={(event) => setChannel(event.target.value === "whatsapp" ? "whatsapp" : "sms")}
        >
          <NativeSelectOption value="sms">{dictionary.channel_sms}</NativeSelectOption>
          <NativeSelectOption value="whatsapp">{dictionary.channel_whatsapp}</NativeSelectOption>
        </NativeSelect>
        <label htmlFor="sms-test-to" className="sr-only">
          {dictionary.test_to}
        </label>
        <Input
          id="sms-test-to"
          type="tel"
          value={to}
          placeholder="+393331234567"
          onChange={(event) => setTo(event.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={test.isPending || !is_configured || to.trim().length < 6}
          onClick={() =>
            test.mutate(
              { channel, to },
              {
                onSuccess: () => toast.success(dictionary.test_sent.replace("{phone}", to)),
                onError: (error) => toast.error(errorText(errors, error)),
              },
            )
          }
        >
          {test.isPending ? <Spinner /> : <SendIcon />}
          {dictionary.test_send}
        </Button>
      </div>
    </SectionCard>
  );
}
