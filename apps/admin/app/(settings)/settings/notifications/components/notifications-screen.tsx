"use client";

import { MailIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { TemplateEditor } from "./template-editor";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { NotificationsOverview } from "@repo/core/actions/emails";
import type { EmailLogStatus } from "@repo/core/backend/types";
import { FormField } from "@repo/core/components/form-field";
import { useEmailLog, useNotifications, useSaveNotifications } from "@repo/core/hooks/use-emails";
import { errorText } from "@repo/core/lib/action-result";
import {
  EMAIL_TEMPLATES,
  notifications_schema,
  type EmailTemplate,
  type TemplateSettings,
} from "@repo/core/lib/email/templates";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { formatDateTime } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";

type NotificationsScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["notifications"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
};

const LOG_TONE: Record<EmailLogStatus, StatusTone> = { sent: "success", failed: "critical", skipped: "attention" };

export function NotificationsScreen(props: NotificationsScreenProps) {
  const notifications = useNotifications();
  if (notifications.isPending) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <Skeleton className="h-96 rounded-xl" />
      </Page>
    );
  }
  if (notifications.isError) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(props.errors, notifications.error)}</p>
      </Page>
    );
  }
  return (
    <NotificationsForm
      key={JSON.stringify([
        notifications.data.templates,
        notifications.data.staff_recipients,
        notifications.data.abandoned_delay_hours,
      ])}
      {...props}
      overview={notifications.data}
    />
  );
}

function NotificationsForm({
  lang,
  can_edit,
  dictionary,
  common,
  errors,
  save_bar,
  overview,
}: NotificationsScreenProps & { overview: NotificationsOverview }) {
  const save = useSaveNotifications();
  const [templates, setTemplates] = useState(overview.templates);
  const [recipients, setRecipients] = useState(overview.staff_recipients.join(", "));
  const [delay_hours, setDelayHours] = useState(overview.abandoned_delay_hours);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [is_editor_open, setIsEditorOpen] = useState(false);
  const [log_page, setLogPage] = useState(1);
  const log = useEmailLog(log_page);

  const recipient_list = recipients
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const value = { staff_recipients: recipient_list, templates, abandoned_delay_hours: delay_hours };
  const parsed = notifications_schema.safeParse(value);
  const is_dirty =
    JSON.stringify(templates) !== JSON.stringify(overview.templates) ||
    recipient_list.join(",") !== overview.staff_recipients.join(",") ||
    delay_hours !== overview.abandoned_delay_hours;

  const setTemplate = (template: EmailTemplate, next: TemplateSettings) =>
    setTemplates((current) => ({ ...current, [template]: next }));

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="narrow">
      {!overview.is_smtp_configured && (
        <p className="bg-warning text-warning-foreground flex flex-wrap items-center gap-x-2 rounded-md px-4 py-3 text-sm">
          {dictionary.smtp_missing}
          <Link href="/settings/email" className="font-medium underline underline-offset-4">
            {dictionary.smtp_link}
          </Link>
        </p>
      )}

      <SectionCard title={dictionary.customer_title} description={dictionary.customer_hint} is_flush>
        <ul className="divide-y border-t">
          {EMAIL_TEMPLATES.map((template) => (
            <li key={template} className="flex items-center gap-3 px-5 py-3.5">
              <MailIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{dictionary.templates[template].title}</span>
                <span className="text-muted-foreground text-xs">{dictionary.templates[template].when}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(template);
                  setIsEditorOpen(true);
                }}
              >
                <PencilIcon />
                {can_edit ? dictionary.edit : dictionary.view}
              </Button>
              <Switch
                checked={templates[template].is_enabled}
                disabled={!can_edit}
                aria-label={dictionary.enabled.replace("{name}", dictionary.templates[template].title)}
                onCheckedChange={(is_enabled) => setTemplate(template, { ...templates[template], is_enabled })}
              />
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title={dictionary.staff_title} description={dictionary.staff_hint}>
        <FormField
          id="staff-recipients"
          label={dictionary.staff_recipients}
          error={parsed.success ? undefined : dictionary.invalid_emails}
        >
          {(control) => (
            <Input
              {...control}
              value={recipients}
              disabled={!can_edit}
              placeholder="owner@example.com, orders@example.com"
              onChange={(event) => setRecipients(event.target.value)}
            />
          )}
        </FormField>
      </SectionCard>

      <SectionCard title={dictionary.abandoned_title} description={dictionary.abandoned_hint}>
        <FormField
          id="abandoned-delay"
          label={dictionary.abandoned_delay}
          description={dictionary.abandoned_delay_hint}
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0}
              max={72}
              value={delay_hours}
              disabled={!can_edit}
              className="max-w-32"
              onChange={(event) =>
                setDelayHours(Math.max(0, Math.min(72, Math.round(Number(event.target.value)) || 0)))
              }
            />
          )}
        </FormField>
      </SectionCard>

      <SectionCard title={dictionary.log_title} description={dictionary.log_hint} is_flush>
        {log.data && log.data.items.length > 0 ? (
          <>
            <ul className="divide-y border-t">
              {log.data.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <StatusBadge tone={LOG_TONE[entry.status]}>{dictionary.log_status[entry.status]}</StatusBadge>
                  <span className="min-w-0 flex-1 truncate">{entry.subject || entry.template}</span>
                  <span className="text-muted-foreground truncate text-xs">{entry.recipient}</span>
                  <span className="text-muted-foreground text-xs">{formatDateTime(entry.created_at, lang)}</span>
                  {entry.error && <p className="text-destructive w-full truncate text-xs">{entry.error}</p>}
                </li>
              ))}
            </ul>
            {log.data.total_pages > 1 && (
              <div className="flex justify-end gap-2 border-t px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={log_page <= 1}
                  onClick={() => setLogPage((page) => page - 1)}
                >
                  {common.previous}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={log_page >= log.data.total_pages}
                  onClick={() => setLogPage((page) => page + 1)}
                >
                  {common.next}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground border-t px-5 py-6 text-sm">{dictionary.log_empty}</p>
        )}
      </SectionCard>

      <TemplateEditor
        template={editing}
        value={editing ? templates[editing] : null}
        default_value={editing ? overview.defaults[editing] : null}
        is_open={is_editor_open}
        onOpenChange={setIsEditorOpen}
        onChange={(next) => editing && setTemplate(editing, next)}
        lang={lang}
        can_edit={can_edit}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={save.isPending}
          can_save={parsed.success}
          onDiscard={() => {
            setTemplates(overview.templates);
            setRecipients(overview.staff_recipients.join(", "));
            setDelayHours(overview.abandoned_delay_hours);
          }}
          onSave={() => {
            if (!parsed.success) return;
            save.mutate(parsed.data, {
              onSuccess: () => toast.success(dictionary.saved),
              onError: (error) => toast.error(errorText(errors, error)),
            });
          }}
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}
