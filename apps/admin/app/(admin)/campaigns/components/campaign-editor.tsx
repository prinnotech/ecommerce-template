"use client";

import { SendIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CAMPAIGN_TONE } from "./campaigns-table";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { useStoreLocales } from "@repo/core/providers/store-languages";
import type { Campaign } from "@repo/core/actions/campaigns";
import { FormField } from "@repo/core/components/form-field";
import {
  useCampaign,
  useCampaignRecipients,
  useDeleteCampaign,
  useSaveCampaign,
  useSendCampaign,
  useSendCampaignTest,
} from "@repo/core/hooks/use-campaigns";
import { useSegments } from "@repo/core/hooks/use-customers";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import {
  CAMPAIGN_PLACEHOLDERS,
  EMPTY_CAMPAIGN,
  campaign_input_schema,
  type CampaignInput,
} from "@repo/core/lib/schemas/campaigns";
import { formatDateTime, formatNumber, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type CampaignEditorProps = {
  lang: string;
  can_edit: boolean;
  // null = a new campaign.
  campaign_id: string | null;
  // Email sending is set up (Settings → Email sending).
  has_smtp: boolean;
  dictionary: AdminDictionary["campaigns"];
  common: AdminDictionary["common"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  errors: AdminDictionary["errors"];
};

export function CampaignEditor(props: CampaignEditorProps) {
  if (!props.campaign_id) return <DraftEditor {...props} campaign={null} />;
  return <ExistingCampaign {...props} campaign_id={props.campaign_id} />;
}

function ExistingCampaign(props: CampaignEditorProps & { campaign_id: string }) {
  const campaign = useCampaign(props.campaign_id);
  if (campaign.isPending) return <Skeleton className="h-96 w-full" />;
  if (campaign.isError) return <p className="text-destructive text-sm">{errorText(props.errors, campaign.error)}</p>;
  if (campaign.data.status === "draft") {
    return <DraftEditor key={campaign.data.updated_at} {...props} campaign={campaign.data} />;
  }
  return <CampaignReport {...props} campaign={campaign.data} />;
}

function DraftEditor({
  lang,
  can_edit,
  campaign,
  has_smtp,
  dictionary,
  common,
  confirm,
  save_bar,
  errors,
}: CampaignEditorProps & { campaign: Campaign | null }) {
  const router = useRouter();
  const save = useSaveCampaign();
  const remove = useDeleteCampaign();
  const send = useSendCampaign();
  const send_test = useSendCampaignTest();
  const segments = useSegments();
  const locales = useStoreLocales();
  const initial: CampaignInput = campaign
    ? { name: campaign.name, segment_id: campaign.segment_id, subject: campaign.subject, body: campaign.body }
    : EMPTY_CAMPAIGN;
  const [form, setForm] = useState<CampaignInput>(initial);
  const [test_locale, setTestLocale] = useState<string>(locales.includes(lang) ? lang : (locales[0] ?? lang));
  const [is_send_open, setIsSendOpen] = useState(false);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const recipients = useCampaignRecipients(form.segment_id);
  const set = (patch: Partial<CampaignInput>) => setForm((current) => ({ ...current, ...patch }));
  const parsed = campaign_input_schema.safeParse(form);
  const is_dirty = campaign === null || JSON.stringify(form) !== JSON.stringify(initial);
  const is_locked = !can_edit;
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const onError = (error: Error) => toast.error(errorText(errors, error));
  const recipient_count = recipients.data?.count ?? 0;

  function onSave() {
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    save.mutate(
      { id: campaign?.id ?? null, campaign: parsed.data },
      {
        onSuccess: ({ id }) => {
          toast.success(dictionary.saved);
          if (!campaign) router.replace(`/campaigns/${id}`);
          else router.refresh();
        },
        onError,
      },
    );
  }

  const main = (
    <>
      <SectionCard>
        <FormField id="campaign-name" label={dictionary.name} description={dictionary.name_hint}>
          {(control) => (
            <Input
              {...control}
              value={form.name}
              maxLength={120}
              disabled={is_locked}
              onChange={(event) => set({ name: event.target.value })}
            />
          )}
        </FormField>
      </SectionCard>
      <SectionCard
        title={dictionary.content_title}
        description={dictionary.placeholders_hint.replace(
          "{placeholders}",
          CAMPAIGN_PLACEHOLDERS.map((name) => `{{${name}}}`).join(", "),
        )}
      >
        <FormField id="campaign-subject" label={dictionary.subject}>
          {() => (
            <LocalizedFields
              id="campaign-subject"
              label={dictionary.subject}
              value={form.subject}
              onChange={(subject) => set({ subject })}
              lang={lang}
              status_labels={status_labels}
              disabled={is_locked}
            />
          )}
        </FormField>
        <FormField id="campaign-body" label={dictionary.body} description={dictionary.body_hint}>
          {() => (
            <LocalizedFields
              id="campaign-body"
              label={dictionary.body}
              value={form.body}
              onChange={(body) => set({ body })}
              lang={lang}
              status_labels={status_labels}
              multiline
              rows={12}
              disabled={is_locked}
            />
          )}
        </FormField>
      </SectionCard>
    </>
  );

  const sidebar = (
    <>
      <SectionCard title={dictionary.audience_title}>
        <FormField id="campaign-segment" label={dictionary.segment}>
          {(control) => (
            <NativeSelect
              {...control}
              value={form.segment_id}
              disabled={is_locked}
              className="w-full"
              onChange={(event) => set({ segment_id: event.target.value })}
            >
              <NativeSelectOption value="">{dictionary.all_subscribers}</NativeSelectOption>
              {(segments.data ?? []).map((segment) => (
                <NativeSelectOption key={segment.id} value={segment.id}>
                  {segment.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <p className="text-sm" role="status">
          {recipients.isPending ? "…" : formatPlural(recipient_count, dictionary.recipients, lang)}
        </p>
        <p className="text-muted-foreground text-xs">{dictionary.audience_hint}</p>
      </SectionCard>

      {can_edit && campaign && (
        <SectionCard title={dictionary.send_title}>
          {!has_smtp && <p className="text-destructive text-sm">{dictionary.smtp_missing}</p>}
          <div className="flex items-end gap-2">
            <FormField id="campaign-test-locale" label={dictionary.test_language}>
              {(control) => (
                <NativeSelect {...control} value={test_locale} onChange={(event) => setTestLocale(event.target.value)}>
                  {locales.map((locale) => (
                    <NativeSelectOption key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <Button
              type="button"
              variant="outline"
              disabled={!has_smtp || is_dirty || send_test.isPending}
              onClick={() =>
                send_test.mutate(
                  { id: campaign.id, locale: test_locale },
                  {
                    onSuccess: ({ to }) => toast.success(dictionary.test_sent.replace("{email}", to)),
                    onError,
                  },
                )
              }
            >
              {send_test.isPending && <Spinner aria-label={common.loading} />}
              {dictionary.send_test}
            </Button>
          </div>
          {is_dirty && <p className="text-muted-foreground text-xs">{dictionary.save_first}</p>}
          <Button
            type="button"
            disabled={!has_smtp || is_dirty || recipient_count === 0 || send.isPending}
            onClick={() => setIsSendOpen(true)}
          >
            <SendIcon />
            {formatPlural(Math.max(recipient_count, 1), dictionary.send_now, lang)}
          </Button>
        </SectionCard>
      )}

      {campaign && can_edit && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive self-start"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2Icon />
          {dictionary.delete}
        </Button>
      )}
    </>
  );

  return (
    <Page
      title={campaign ? campaign.name : dictionary.new_title}
      title_meta={
        campaign ? <StatusBadge tone={CAMPAIGN_TONE.draft}>{dictionary.status.draft}</StatusBadge> : undefined
      }
      back={{ href: "/campaigns", label: dictionary.title }}
    >
      <DetailLayout main={main} sidebar={sidebar} />
      {campaign && (
        <>
          <ConfirmDialog
            is_open={is_send_open}
            onOpenChange={setIsSendOpen}
            title={dictionary.send_confirm_title}
            body={formatPlural(recipient_count, dictionary.send_confirm_body, lang)}
            confirm_label={formatPlural(Math.max(recipient_count, 1), dictionary.send_now, lang)}
            cancel_label={confirm.cancel}
            is_pending={send.isPending}
            onConfirm={() =>
              send.mutate(campaign.id, {
                onSuccess: () => {
                  setIsSendOpen(false);
                  toast.success(dictionary.sending_started);
                  router.refresh();
                },
                onError,
              })
            }
          />
          <ConfirmDialog
            is_open={is_delete_open}
            onOpenChange={setIsDeleteOpen}
            title={dictionary.delete_title}
            body={dictionary.delete_body}
            confirm_label={dictionary.delete}
            cancel_label={confirm.cancel}
            is_pending={remove.isPending}
            is_destructive
            onConfirm={() => remove.mutate(campaign.id, { onSuccess: () => router.push("/campaigns"), onError })}
          />
        </>
      )}
      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={save.isPending}
          can_save={parsed.success}
          onDiscard={() => (campaign ? setForm(initial) : router.push("/campaigns"))}
          onSave={onSave}
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}

// A campaign that went out: its numbers (refreshed while sending) and what was sent.
function CampaignReport({ lang, campaign, dictionary }: CampaignEditorProps & { campaign: Campaign }) {
  const segments = useSegments();
  const locale = lang as Locale;
  const pending = Math.max(0, campaign.recipient_count - campaign.sent_count - campaign.failed_count);
  const segment_name =
    campaign.segment_id === ""
      ? dictionary.all_subscribers
      : ((segments.data ?? []).find((segment) => segment.id === campaign.segment_id)?.name ??
        dictionary.deleted_segment);
  const stats = [
    { label: dictionary.stats.recipients, value: campaign.recipient_count },
    { label: dictionary.stats.sent, value: campaign.sent_count },
    { label: dictionary.stats.failed, value: campaign.failed_count },
    { label: dictionary.stats.pending, value: pending },
  ];

  return (
    <Page
      title={campaign.name}
      title_meta={<StatusBadge tone={CAMPAIGN_TONE[campaign.status]}>{dictionary.status[campaign.status]}</StatusBadge>}
      subtitle={
        campaign.sent_at ? dictionary.sent_on.replace("{date}", formatDateTime(campaign.sent_at, lang)) : undefined
      }
      back={{ href: "/campaigns", label: dictionary.title }}
    >
      <DetailLayout
        main={
          <>
            <SectionCard>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatNumber(stat.value, lang)}</dd>
                  </div>
                ))}
              </dl>
              {campaign.status === "sending" && (
                <p className="text-muted-foreground text-xs">{dictionary.sending_hint}</p>
              )}
            </SectionCard>
            <SectionCard title={localized(campaign.subject, locale)}>
              <p className="text-sm whitespace-pre-line">{localized(campaign.body, locale)}</p>
            </SectionCard>
          </>
        }
        sidebar={
          <SectionCard title={dictionary.audience_title}>
            <p className="text-sm">{segment_name}</p>
          </SectionCard>
        }
      />
    </Page>
  );
}
