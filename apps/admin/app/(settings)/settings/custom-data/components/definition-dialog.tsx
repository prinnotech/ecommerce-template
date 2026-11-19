"use client";

import { useState } from "react";
import { toast } from "sonner";

import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { FormField } from "@repo/core/components/form-field";
import { useCreateMetafieldDefinition, useUpdateMetafieldDefinition } from "@repo/core/hooks/use-metafields";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { LocalizedText } from "@repo/core/lib/localized";
import {
  METAFIELD_TYPES,
  metafield_definition_schema,
  type MetafieldDefinition,
  type MetafieldDefinitionInput,
  type MetafieldOwner,
} from "@repo/core/lib/schemas/metafields";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";

type DefinitionDialogProps = {
  lang: string;
  owner: MetafieldOwner;
  // null = a new field for `owner`.
  definition: MetafieldDefinition | null;
  is_open: boolean;
  onClose: () => void;
  dictionary: AdminDictionary["custom_data"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

export function DefinitionDialog(props: DefinitionDialogProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={(is_open) => !is_open && props.onClose()}>
      {props.is_open && <DefinitionForm {...props} />}
    </Dialog>
  );
}

// "Fabric care" → "fabric_care".
function keyFrom(name: LocalizedText): string {
  const text = Object.values(name).find((value) => value.trim()) ?? "";
  const key = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 40);
  return key;
}

function DefinitionForm({ lang, owner, definition, onClose, dictionary, common, errors }: DefinitionDialogProps) {
  const create = useCreateMetafieldDefinition();
  const update = useUpdateMetafieldDefinition();
  const is_new = definition === null;
  const [form, setForm] = useState<MetafieldDefinitionInput>(
    definition
      ? {
          owner: definition.owner,
          key: definition.key,
          name: definition.name,
          description: definition.description,
          type: definition.type,
          is_storefront: definition.is_storefront,
        }
      : { owner, key: "", name: {}, description: {}, type: "text", is_storefront: owner !== "customer" },
  );
  const [is_key_manual, setIsKeyManual] = useState(!is_new);
  const [is_submitted, setIsSubmitted] = useState(false);
  const set = (patch: Partial<MetafieldDefinitionInput>) => setForm((current) => ({ ...current, ...patch }));
  const parsed = metafield_definition_schema.safeParse(form);
  const issue = (path: string) =>
    is_submitted && !parsed.success && parsed.error.issues.some((item) => item.path[0] === path);
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const is_pending = create.isPending || update.isPending;

  function submit() {
    setIsSubmitted(true);
    if (!parsed.success) return;
    const callbacks = {
      onSuccess: () => {
        toast.success(dictionary.saved);
        onClose();
      },
      onError: (error: Error) => toast.error(errorText(errors, error)),
    };
    if (definition) update.mutate({ id: definition.id, definition: parsed.data }, callbacks);
    else create.mutate(parsed.data, callbacks);
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {is_new ? dictionary.add_title.replace("{owner}", dictionary.owners[owner]) : dictionary.edit_title}
        </DialogTitle>
        <DialogDescription>{dictionary.dialog_hint}</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <FormField id="field-name" label={dictionary.name} error={issue("name") ? dictionary.name_required : undefined}>
          {() => (
            <LocalizedFields
              id="field-name"
              label={dictionary.name}
              value={form.name}
              onChange={(name) => set({ name, key: is_key_manual ? form.key : keyFrom(name) })}
              lang={lang}
              status_labels={status_labels}
              invalid={issue("name")}
            />
          )}
        </FormField>
        <FormField
          id="field-key"
          label={dictionary.key}
          description={is_new ? dictionary.key_hint : dictionary.key_fixed}
          error={issue("key") ? dictionary.key_invalid : undefined}
        >
          {(control) => (
            <Input
              {...control}
              value={form.key}
              disabled={!is_new}
              maxLength={40}
              className="font-mono"
              onChange={(event) => {
                setIsKeyManual(true);
                set({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") });
              }}
            />
          )}
        </FormField>
        <FormField
          id="field-type"
          label={dictionary.type}
          description={is_new ? undefined : dictionary.type_change_hint}
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={form.type}
              className="w-full"
              onChange={(event) => set({ type: METAFIELD_TYPES.find((type) => type === event.target.value) ?? "text" })}
            >
              {METAFIELD_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {dictionary.types[type]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="field-description" label={dictionary.description} description={dictionary.description_hint}>
          {() => (
            <LocalizedFields
              id="field-description"
              label={dictionary.description}
              value={form.description}
              onChange={(description) => set({ description })}
              lang={lang}
              status_labels={status_labels}
            />
          )}
        </FormField>
        {owner !== "customer" && (
          <label className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{dictionary.storefront}</span>
              <span className="text-muted-foreground text-xs">{dictionary.storefront_hint}</span>
            </span>
            <Switch
              checked={form.is_storefront}
              aria-label={dictionary.storefront}
              onCheckedChange={(is_storefront) => set({ is_storefront })}
            />
          </label>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={is_pending}>
          {common.cancel}
        </Button>
        <Button type="button" onClick={submit} disabled={is_pending}>
          {is_pending && <Spinner aria-label={common.loading} />}
          {common.save}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
