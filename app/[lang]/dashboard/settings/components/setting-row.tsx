"use client";

import { useState } from "react";
import { toast } from "sonner";

import { SettingControl } from "./setting-controls";
import type { SelectOption, SettingOptions } from "./settings-screen";
import type { SettingEntry } from "@/app/actions/site-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useResetSetting, useUpdateSetting } from "@/hooks/use-site-settings";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { SITE_SETTINGS, type SettingKey } from "@/lib/site-settings";
import { formatDateTime } from "@/lib/utils/format";

type SettingRowProps = {
  lang: string;
  entry: SettingEntry;
  can_edit: boolean;
  options: SettingOptions;
  currency: string;
  dictionary: Dictionary["settings"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

type ItemText = { label: string; description: string; fields?: Record<string, string> };

export function SettingRow({ lang, entry, can_edit, options, currency, dictionary, common, errors }: SettingRowProps) {
  const update_setting = useUpdateSetting();
  const reset_setting = useResetSetting();
  const [draft, setDraft] = useState<unknown>(entry.value);

  const item: ItemText = dictionary.items[entry.key.toLowerCase() as Lowercase<SettingKey>];
  const control_id = `setting-${entry.key}`;
  const is_dirty = JSON.stringify(draft) !== JSON.stringify(entry.value);
  const parsed = SITE_SETTINGS[entry.key].schema.safeParse(draft);
  const is_busy = update_setting.isPending || reset_setting.isPending;

  const select_options: SelectOption[] =
    entry.input === "currency"
      ? options.currencies
      : entry.input === "timezone"
        ? options.timezones
        : entry.input === "locale"
          ? options.locales
          : [];

  function onSave() {
    if (!parsed.success) return;
    update_setting.mutate(
      { key: entry.key, value: parsed.data },
      {
        onSuccess: () => toast.success(dictionary.saved.replace("{setting}", item.label)),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function onReset() {
    reset_setting.mutate(
      { key: entry.key },
      {
        onSuccess: () => toast.success(dictionary.reset_done.replace("{setting}", item.label)),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <section
      aria-labelledby={`${control_id}-label`}
      className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${control_id}-label`} className="text-sm font-medium">
          {item.label}
        </h2>
        <p className="text-muted-foreground text-sm">{item.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {entry.is_default ? (
            <Badge variant="outline">{dictionary.default_badge}</Badge>
          ) : (
            entry.updated_at && (
              <span className="text-muted-foreground text-xs">
                {dictionary.updated_at.replace("{date}", formatDateTime(entry.updated_at, lang))}
              </span>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SettingControl
          id={control_id}
          label={item.label}
          input={entry.input}
          value={draft}
          default_value={entry.default_value}
          onChange={setDraft}
          is_disabled={!can_edit || is_busy}
          is_invalid={is_dirty && !parsed.success}
          select_options={select_options}
          countries={options.countries}
          locales={options.locales}
          currency={currency}
          lang={lang}
          field_labels={item.fields ?? {}}
          dictionary={dictionary}
        />
        {is_dirty && !parsed.success && (
          <p role="alert" className="text-destructive text-sm">
            {dictionary.invalid}
          </p>
        )}
        {can_edit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!entry.is_default && (
              <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={is_busy}>
                {reset_setting.isPending && <Spinner aria-label={common.loading} />}
                {dictionary.reset}
              </Button>
            )}
            {is_dirty && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(entry.value)} disabled={is_busy}>
                {common.cancel}
              </Button>
            )}
            <Button type="button" size="sm" onClick={onSave} disabled={!is_dirty || !parsed.success || is_busy}>
              {update_setting.isPending && <Spinner aria-label={common.loading} />}
              {common.save}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
