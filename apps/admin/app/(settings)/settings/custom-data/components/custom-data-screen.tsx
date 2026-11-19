"use client";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DefinitionDialog } from "./definition-dialog";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import {
  useDeleteMetafieldDefinition,
  useMetafieldDefinitions,
  useMoveMetafieldDefinition,
} from "@repo/core/hooks/use-metafields";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import {
  MAX_METAFIELD_DEFINITIONS,
  METAFIELD_OWNERS,
  type MetafieldDefinition,
  type MetafieldOwner,
} from "@repo/core/lib/schemas/metafields";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

type CustomDataScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["custom_data"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Settings → Custom data: the extra fields of products, collections and customers, one tab each.
export function CustomDataScreen({ lang, can_edit, dictionary, confirm, common, errors }: CustomDataScreenProps) {
  const definitions = useMetafieldDefinitions();
  const move = useMoveMetafieldDefinition();
  const remove = useDeleteMetafieldDefinition();
  const [owner, setOwner] = useState<MetafieldOwner>("product");
  // "new" = adding a field to the current tab.
  const [editing, setEditing] = useState<MetafieldDefinition | "new" | null>(null);
  const [deleting, setDeleting] = useState<MetafieldDefinition | null>(null);
  const locale = lang as Locale;
  const list = (definitions.data ?? []).filter((definition) => definition.owner === owner);
  const onError = (error: Error) => toast.error(errorText(errors, error));

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="narrow"
      primary_action={
        can_edit ? (
          <Button type="button" disabled={list.length >= MAX_METAFIELD_DEFINITIONS} onClick={() => setEditing("new")}>
            <PlusIcon />
            {dictionary.add}
          </Button>
        ) : undefined
      }
    >
      <div role="tablist" aria-label={dictionary.title} className="bg-muted flex w-fit gap-1 rounded-lg p-1">
        {METAFIELD_OWNERS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={owner === item}
            onClick={() => setOwner(item)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              owner === item ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {dictionary.owners[item]}
          </button>
        ))}
      </div>

      <SectionCard title={dictionary.owners[owner]} description={dictionary.owner_hints[owner]}>
        {definitions.isPending ? (
          <Skeleton className="h-24 rounded-md" />
        ) : definitions.isError ? (
          <p className="text-destructive text-sm">{errorText(errors, definitions.error)}</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground text-sm">{dictionary.empty}</p>
        ) : (
          <ul className="divide-y">
            {list.map((definition, index) => {
              const name = localized(definition.name, locale) || definition.key;
              return (
                <li key={definition.id} className="flex items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {name}
                      {definition.is_storefront && (
                        <StatusBadge tone="info" has_dot={false}>
                          {dictionary.on_store}
                        </StatusBadge>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      <code className="font-mono">{definition.key}</code> · {dictionary.types[definition.type]}
                    </span>
                  </div>
                  {can_edit && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0 || move.isPending}
                        aria-label={dictionary.move_up.replace("{name}", name)}
                        onClick={() => move.mutate({ id: definition.id, direction: -1 }, { onError })}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === list.length - 1 || move.isPending}
                        aria-label={dictionary.move_down.replace("{name}", name)}
                        onClick={() => move.mutate({ id: definition.id, direction: 1 }, { onError })}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.edit.replace("{name}", name)}
                        onClick={() => setEditing(definition)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.delete.replace("{name}", name)}
                        onClick={() => setDeleting(definition)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <DefinitionDialog
        lang={lang}
        owner={owner}
        definition={editing === "new" ? null : editing}
        is_open={editing !== null}
        onClose={() => setEditing(null)}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
      <ConfirmDialog
        is_open={deleting !== null}
        onOpenChange={(is_open) => !is_open && setDeleting(null)}
        title={dictionary.delete_title}
        body={dictionary.delete_body}
        confirm_label={dictionary.delete_confirm}
        cancel_label={confirm.cancel}
        is_pending={remove.isPending}
        is_destructive
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success(dictionary.deleted);
            },
            onError,
          })
        }
      />
    </Page>
  );
}
