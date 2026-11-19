"use client";

import { ImagesIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/media-picker";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import type { MetafieldsView } from "@repo/core/actions/metafields";
import { FormField } from "@repo/core/components/form-field";
import { useMetafields, useSetMetafields } from "@repo/core/hooks/use-metafields";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized, type LocalizedText } from "@repo/core/lib/localized";
import type { MetafieldDefinition, MetafieldOwner, MetafieldValue } from "@repo/core/lib/schemas/metafields";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type MetafieldsCardProps = {
  owner: MetafieldOwner;
  // The product or collection id, or the customer key.
  owner_key: string;
  can_edit: boolean;
  // Shows the "Settings → Custom data" link when there are no fields yet.
  can_manage: boolean;
  lang: string;
  dictionary: AdminDictionary["custom_data"];
  files_picker: AdminDictionary["files"]["picker"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// "Custom fields" on a product, collection or customer page: one input per field from Settings →
// Custom data, saved with its own button (apart from the page's save bar).
export function MetafieldsCard(props: MetafieldsCardProps) {
  const metafields = useMetafields(props.owner, props.owner_key);
  const { dictionary, errors } = props;
  return (
    <SectionCard title={dictionary.card_title}>
      {metafields.isPending ? (
        <Skeleton className="h-20 rounded-md" />
      ) : metafields.isError ? (
        <p className="text-destructive text-sm">{errorText(errors, metafields.error)}</p>
      ) : metafields.data.definitions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {dictionary.card_empty}{" "}
          {props.can_manage && (
            <Link href="/settings/custom-data" className="text-foreground underline-offset-4 hover:underline">
              {dictionary.card_manage}
            </Link>
          )}
        </p>
      ) : (
        // Mounted again after a save, so the form starts from the stored values.
        <MetafieldsForm key={JSON.stringify(metafields.data.values)} view={metafields.data} {...props} />
      )}
    </SectionCard>
  );
}

function MetafieldsForm({
  view,
  owner,
  owner_key,
  can_edit,
  lang,
  dictionary,
  files_picker,
  common,
  errors,
}: MetafieldsCardProps & { view: MetafieldsView }) {
  const save = useSetMetafields();
  const [values, setValues] = useState<Record<string, MetafieldValue | undefined>>(view.values);
  const [picking, setPicking] = useState<string | null>(null);
  const is_dirty = JSON.stringify(clean(values)) !== JSON.stringify(clean(view.values));
  const locale = lang as Locale;
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const set = (key: string, value: MetafieldValue | undefined) =>
    setValues((current) => ({ ...current, [key]: value }));

  function field(definition: MetafieldDefinition) {
    const id = `metafield-${owner}-${definition.key}`;
    const value = values[definition.key];
    const disabled = !can_edit;
    switch (definition.type) {
      case "text":
      case "multiline":
        return (
          <LocalizedFields
            id={id}
            label={localized(definition.name, locale)}
            value={typeof value === "object" ? value : {}}
            onChange={(text: LocalizedText) => set(definition.key, text)}
            lang={lang}
            status_labels={status_labels}
            multiline={definition.type === "multiline"}
            rows={4}
            disabled={disabled}
          />
        );
      case "number":
        return (
          <Input
            id={id}
            type="number"
            step="any"
            value={typeof value === "number" ? value : ""}
            disabled={disabled}
            onChange={(event) =>
              set(definition.key, event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
        );
      case "boolean":
        return (
          <NativeSelect
            id={id}
            value={value === true ? "true" : value === false ? "false" : ""}
            disabled={disabled}
            className="w-full"
            onChange={(event) =>
              set(definition.key, event.target.value === "" ? undefined : event.target.value === "true")
            }
          >
            <NativeSelectOption value="">{dictionary.not_set}</NativeSelectOption>
            <NativeSelectOption value="true">{dictionary.yes}</NativeSelectOption>
            <NativeSelectOption value="false">{dictionary.no}</NativeSelectOption>
          </NativeSelect>
        );
      case "date":
        return (
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(event) => set(definition.key, event.target.value || undefined)}
          />
        );
      case "url":
        return (
          <Input
            id={id}
            type="url"
            placeholder="https://"
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(event) => set(definition.key, event.target.value.trim() || undefined)}
          />
        );
      case "color":
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={localized(definition.name, locale)}
              value={typeof value === "string" ? value : "#000000"}
              disabled={disabled}
              onChange={(event) => set(definition.key, event.target.value)}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed"
            />
            <Input
              id={id}
              value={typeof value === "string" ? value : ""}
              placeholder="#000000"
              maxLength={7}
              disabled={disabled}
              className="font-mono"
              onChange={(event) => set(definition.key, event.target.value.trim().toLowerCase() || undefined)}
            />
          </div>
        );
      case "file":
        return (
          <div className="flex items-center gap-3">
            {typeof value === "string" && value && (
              <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md border">
                <Image src={value} alt="" fill unoptimized sizes="3.5rem" className="object-cover" />
              </span>
            )}
            {!disabled && (
              <Button id={id} type="button" variant="outline" size="sm" onClick={() => setPicking(definition.key)}>
                <ImagesIcon />
                {value ? dictionary.change_file : dictionary.choose_file}
              </Button>
            )}
            {!disabled && value && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={dictionary.clear.replace("{name}", localized(definition.name, locale))}
                onClick={() => set(definition.key, undefined)}
              >
                <XIcon />
              </Button>
            )}
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {view.definitions.map((definition) => (
        <FormField
          key={definition.id}
          id={`metafield-${owner}-${definition.key}`}
          label={localized(definition.name, locale) || definition.key}
          description={localized(definition.description, locale) || undefined}
        >
          {() => field(definition)}
        </FormField>
      ))}
      {can_edit && (
        <div className="flex justify-end gap-2">
          {is_dirty && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setValues(view.values)}>
              {dictionary.discard}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!is_dirty || save.isPending}
            onClick={() =>
              save.mutate(
                { owner, owner_key, values: clean(values) },
                {
                  onSuccess: () => toast.success(dictionary.values_saved),
                  onError: (error) => toast.error(errorText(errors, error)),
                },
              )
            }
          >
            {save.isPending && <Spinner aria-label={common.loading} />}
            {dictionary.save_values}
          </Button>
        </div>
      )}
      <MediaPicker
        is_open={picking !== null}
        onOpenChange={(is_open) => !is_open && setPicking(null)}
        mode="single"
        onPick={([item]) => {
          if (item && picking) set(picking, item.url);
        }}
        can_upload={can_edit}
        lang={lang}
        dictionary={files_picker}
        errors={errors}
      />
    </div>
  );
}

// Without the fields left empty, so "cleared" and "never set" compare the same.
function clean(values: Record<string, MetafieldValue | undefined>): Record<string, MetafieldValue> {
  const result: Record<string, MetafieldValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    if (typeof value === "object" && !Object.values(value).some((text) => text.trim())) continue;
    result[key] = value;
  }
  return result;
}
