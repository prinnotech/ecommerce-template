"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SettingControl } from "./setting-controls";
import type { SettingOptions } from "../options";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { updateSetting } from "@repo/core/actions/site-settings";
import { useAllSettings } from "@repo/core/hooks/use-site-settings";
import { errorText, unwrap } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { SITE_SETTINGS, type SettingKey } from "@repo/core/lib/site-settings";
import { formatDateTime } from "@repo/core/lib/utils/format";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { SETTINGS_SECTIONS, type SettingsSectionKey } from "../sections";

type SettingsSectionProps = {
  lang: string;
  section_key: SettingsSectionKey;
  can_edit: boolean;
  options: SettingOptions;
  dictionary: AdminDictionary["settings"];
  errors: AdminDictionary["errors"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
};

type ItemText = { label: string; description: string; fields?: Record<string, string> };

export function SettingsSection({
  lang,
  section_key,
  can_edit,
  options,
  dictionary,
  errors,
  save_bar,
}: SettingsSectionProps) {
  const settings = useAllSettings();
  const query_client = useQueryClient();
  // Edits that haven't been saved yet: key -> new value. Absent keys show the stored value.
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [is_saving, setIsSaving] = useState(false);

  if (settings.isPending) return <Skeleton className="h-96 w-full" />;
  if (settings.isError) return <p className="text-destructive text-sm">{errorText(errors, settings.error)}</p>;

  const categories = SETTINGS_SECTIONS.find((section) => section.key === section_key)?.categories ?? [];
  const entries = settings.data.filter((entry) => categories.includes(entry.category));
  const currency_entry = settings.data.find((entry) => entry.key === "CURRENCY");
  const currency = typeof currency_entry?.value === "string" ? currency_entry.value : "EUR";

  const dirty_entries = entries.filter((entry) => {
    const value = overrides[entry.key];
    return value !== undefined && JSON.stringify(value) !== JSON.stringify(entry.value);
  });
  const isInvalid = (key: SettingKey) =>
    overrides[key] !== undefined && !SITE_SETTINGS[key].schema.safeParse(overrides[key]).success;
  const can_save = dirty_entries.length > 0 && dirty_entries.every((entry) => !isInvalid(entry.key));

  function setValue(key: SettingKey, value: unknown) {
    setOverrides((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setIsSaving(true);
    try {
      await Promise.all(
        dirty_entries.map(async (entry) =>
          unwrap(await updateSetting({ key: entry.key, value: overrides[entry.key] })),
        ),
      );
      await Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.all_settings }),
        query_client.invalidateQueries({ queryKey: query_keys.site_settings }),
      ]);
      setOverrides({});
      toast.success(dictionary.saved_all);
    } catch (error) {
      toast.error(errorText(errors, error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.sections[section_key]}</h1>
        <p className="text-muted-foreground text-sm">{dictionary.subtitle}</p>
        {!can_edit && <p className="text-muted-foreground text-sm">{dictionary.read_only}</p>}
      </div>

      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {entries.map((entry) => {
            const control_id = `setting-${entry.key}`;
            const item: ItemText = dictionary.items[entry.key.toLowerCase() as Lowercase<SettingKey>];
            const value = overrides[entry.key] ?? entry.value;
            const invalid = isInvalid(entry.key);
            const select_options =
              entry.input === "currency"
                ? options.currencies
                : entry.input === "timezone"
                  ? options.timezones
                  : entry.input === "locale"
                    ? options.locales
                    : [];

            return (
              <section
                key={entry.key}
                aria-labelledby={`${control_id}-label`}
                className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-8"
              >
                <div className="flex flex-col gap-1">
                  <h2 id={`${control_id}-label`} className="text-sm font-medium">
                    {item.label}
                  </h2>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                  {/* No "Default" badge on untouched settings (audit S1); a changed one says when. */}
                  {!entry.is_default && entry.updated_at && (
                    <span className="text-muted-foreground mt-1 text-xs">
                      {dictionary.updated_at.replace("{date}", formatDateTime(entry.updated_at, lang))}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <SettingControl
                    id={control_id}
                    label={item.label}
                    input={entry.input}
                    value={value}
                    default_value={entry.default_value}
                    onChange={(next) => setValue(entry.key, next)}
                    is_disabled={!can_edit || is_saving}
                    is_invalid={invalid}
                    select_options={select_options}
                    countries={options.countries}
                    locales={options.locales}
                    currency={currency}
                    lang={lang}
                    field_labels={item.fields ?? {}}
                    asset_kind={
                      entry.key === "SITE_LOGO_URL" ? "logo" : entry.key === "SITE_FAVICON_URL" ? "favicon" : undefined
                    }
                    dictionary={dictionary}
                    errors={errors}
                  />
                  {invalid && (
                    <p role="alert" className="text-destructive text-sm">
                      {dictionary.invalid}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>

      <SaveBar
        is_dirty={dirty_entries.length > 0}
        is_saving={is_saving}
        onSave={save}
        onDiscard={() => setOverrides({})}
        can_save={can_save}
        dictionary={save_bar}
      />
    </div>
  );
}
