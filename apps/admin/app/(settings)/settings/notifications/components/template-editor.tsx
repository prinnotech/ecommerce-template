"use client";

import { RotateCcwIcon, SendIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { usePreviewEmail, useSendTemplateTest } from "@repo/core/hooks/use-emails";
import { errorText } from "@repo/core/lib/action-result";
import { PLACEHOLDERS, type EmailTemplate, type TemplateSettings } from "@repo/core/lib/email/templates";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";

const PREVIEW_DELAY_MS = 500;

type TemplateEditorProps = {
  template: EmailTemplate | null;
  value: TemplateSettings | null;
  default_value: TemplateSettings | null;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  onChange: (value: TemplateSettings) => void;
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["notifications"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Subject and body per language, with the email as it will look (built by the server from the
// newest order, or a sample one), and "send me a test".
export function TemplateEditor(props: TemplateEditorProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-5xl">
        {props.template && props.value && props.default_value && (
          <EditorBody
            key={props.template}
            {...props}
            template={props.template}
            value={props.value}
            default_value={props.default_value}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorBody({
  template,
  value,
  default_value,
  onChange,
  lang,
  can_edit,
  dictionary,
  common,
  errors,
}: TemplateEditorProps & { template: EmailTemplate; value: TemplateSettings; default_value: TemplateSettings }) {
  const preview = usePreviewEmail();
  const test = useSendTemplateTest();
  const [preview_lang, setPreviewLang] = useState<Locale>(isLocale(lang) ? lang : LOCALES[0]);
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const { mutate: requestPreview } = preview;

  // Rebuild the preview a moment after typing stops.
  useEffect(() => {
    const timer = window.setTimeout(
      () => requestPreview({ template, locale: preview_lang, config: value }),
      PREVIEW_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [template, preview_lang, value, requestPreview]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>{dictionary.templates[template].title}</DialogTitle>
          <DialogDescription>{dictionary.templates[template].when}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="template-subject">{dictionary.subject}</FieldLabel>
          <LocalizedFields
            id="template-subject"
            label={dictionary.subject}
            value={value.subject}
            onChange={(subject) => onChange({ ...value, subject })}
            lang={lang}
            status_labels={status_labels}
            disabled={!can_edit}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="template-body">{dictionary.body}</FieldLabel>
          <LocalizedFields
            id="template-body"
            label={dictionary.body}
            value={value.body}
            onChange={(body) => onChange({ ...value, body })}
            lang={lang}
            status_labels={status_labels}
            multiline
            rows={10}
            disabled={!can_edit}
          />
          <FieldDescription>{dictionary.body_hint}</FieldDescription>
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{dictionary.placeholders}</p>
          <ul className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((name) => (
              <li key={name}>
                <code className="bg-muted rounded px-1.5 py-0.5 text-xs" title={dictionary.placeholder_labels[name]}>
                  {`{{${name}}}`}
                </code>
              </li>
            ))}
          </ul>
        </div>
        {can_edit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={test.isPending}
              onClick={() =>
                test.mutate(
                  { template, locale: preview_lang, config: value },
                  {
                    onSuccess: (result) => toast.success(dictionary.test_sent.replace("{email}", result.to)),
                    onError: (error) => toast.error(errorText(errors, error)),
                  },
                )
              }
            >
              {test.isPending ? <Spinner /> : <SendIcon />}
              {dictionary.send_test}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...default_value, is_enabled: value.is_enabled })}
            >
              <RotateCcwIcon />
              {dictionary.reset}
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-h-[28rem] flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{dictionary.preview}</p>
          <label htmlFor="preview-language" className="sr-only">
            {dictionary.preview_language}
          </label>
          <NativeSelect
            id="preview-language"
            size="sm"
            value={preview_lang}
            onChange={(event) => setPreviewLang(LOCALES.find((locale) => locale === event.target.value) ?? LOCALES[0])}
            className="uppercase"
          >
            {LOCALES.map((locale) => (
              <NativeSelectOption key={locale} value={locale}>
                {locale}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {dictionary.subject}: {preview.data?.subject ?? "…"}
        </p>
        {/* sandbox: the email's HTML runs no scripts and can't reach the admin. */}
        <iframe
          title={dictionary.preview}
          sandbox=""
          srcDoc={preview.data?.html ?? ""}
          className="bg-muted/40 h-full min-h-[26rem] w-full flex-1 rounded-md border"
        />
      </div>
    </div>
  );
}
