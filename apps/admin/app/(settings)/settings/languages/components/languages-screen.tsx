"use client";

import { EllipsisIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { LanguageRow, LanguagesOverview } from "@repo/core/actions/languages";
import { FormField } from "@repo/core/components/form-field";
import { useLanguages, useSaveLanguages } from "@repo/core/hooks/use-languages";
import { isLocale, type Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { languageName, SUGGESTED_LANGUAGES, type StoreLanguage } from "@repo/core/lib/languages";
import { formatNumber } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type LanguagesScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["languages"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

export function LanguagesScreen(props: LanguagesScreenProps) {
  const overview = useLanguages();
  if (overview.isPending) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <Skeleton className="h-64 rounded-xl" />
      </Page>
    );
  }
  if (overview.isError) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(props.errors, overview.error)}</p>
      </Page>
    );
  }
  return <LanguagesList {...props} overview={overview.data} />;
}

function LanguagesList({
  lang,
  can_edit,
  dictionary,
  common,
  errors,
  overview,
}: LanguagesScreenProps & { overview: LanguagesOverview }) {
  const save = useSaveLanguages();
  const [is_add_open, setIsAddOpen] = useState(false);
  const [removing, setRemoving] = useState<LanguageRow | null>(null);
  const languages: StoreLanguage[] = overview.languages.map(({ code, is_published }) => ({ code, is_published }));
  const name = (code: Locale) => languageName(code, lang);

  function commit(next: StoreLanguage[], default_locale: Locale = overview.default_locale, after_save?: () => void) {
    save.mutate(
      { languages: next, default_locale },
      {
        onSuccess: () => {
          toast.success(dictionary.saved);
          after_save?.();
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  const setPublished = (code: Locale, is_published: boolean) =>
    commit(languages.map((item) => (item.code === code ? { ...item, is_published } : item)));

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.description}
      width="narrow"
      primary_action={
        can_edit ? (
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            <PlusIcon />
            {dictionary.add}
          </Button>
        ) : undefined
      }
    >
      <SectionCard is_flush footer={<p className="text-muted-foreground text-xs">{dictionary.default_hint}</p>}>
        <ul className="divide-y">
          {overview.languages.map((row) => (
            <li key={row.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  {name(row.code)}
                  <span className="text-muted-foreground text-xs font-normal uppercase">{row.code}</span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {dictionary.column_progress}:{" "}
                  {dictionary.progress
                    .replace("{translated}", formatNumber(row.translated, lang))
                    .replace("{total}", formatNumber(row.total, lang))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {row.is_default && <StatusBadge tone="info">{dictionary.default}</StatusBadge>}
                <StatusBadge tone={row.is_published ? "success" : "neutral"}>
                  {row.is_published ? dictionary.published : dictionary.hidden}
                </StatusBadge>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/settings/languages/${row.code}`}>{dictionary.translate}</Link>
                </Button>
                {can_edit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={dictionary.more_actions}>
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {row.is_published ? (
                        <DropdownMenuItem
                          disabled={row.is_default || save.isPending}
                          onSelect={() => setPublished(row.code, false)}
                        >
                          {dictionary.unpublish}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled={save.isPending} onSelect={() => setPublished(row.code, true)}>
                          {dictionary.publish}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={row.is_default || !row.is_published || save.isPending}
                        onSelect={() => commit(languages, row.code)}
                      >
                        {dictionary.make_default}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={row.is_default || languages.length <= 1}
                        onSelect={() => setRemoving(row)}
                      >
                        {dictionary.remove}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <AddLanguageDialog
        is_open={is_add_open}
        onOpenChange={setIsAddOpen}
        existing={languages.map((item) => item.code)}
        lang={lang}
        is_pending={save.isPending}
        onAdd={(code) => commit([...languages, { code, is_published: false }], undefined, () => setIsAddOpen(false))}
        dictionary={dictionary}
        common={common}
      />
      <ConfirmDialog
        is_open={removing !== null}
        onOpenChange={(is_open) => !is_open && setRemoving(null)}
        title={dictionary.remove_title.replace("{name}", removing ? name(removing.code) : "")}
        body={dictionary.remove_body}
        confirm_label={dictionary.remove}
        cancel_label={common.cancel}
        is_destructive
        is_pending={save.isPending}
        onConfirm={() => {
          if (!removing) return;
          commit(
            languages.filter((item) => item.code !== removing.code),
            undefined,
            () => setRemoving(null),
          );
        }}
      />
    </Page>
  );
}

function AddLanguageDialog({
  is_open,
  onOpenChange,
  existing,
  lang,
  is_pending,
  onAdd,
  dictionary,
  common,
}: {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  existing: Locale[];
  lang: string;
  is_pending: boolean;
  onAdd: (code: Locale) => void;
  dictionary: AdminDictionary["languages"];
  common: AdminDictionary["common"];
}) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const suggestions = SUGGESTED_LANGUAGES.filter((code) => !existing.includes(code))
    .map((code) => ({ code, label: languageName(code, lang) }))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
  const code = custom.trim() || choice;
  const is_valid = isLocale(code) && !existing.includes(code);

  return (
    <Dialog
      open={is_open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setChoice("");
          setCustom("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dictionary.add_title}</DialogTitle>
          <DialogDescription>{dictionary.add_body}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (is_valid) onAdd(code);
          }}
        >
          <FormField id="language-choice" label={dictionary.choose}>
            {(control) => (
              <NativeSelect
                {...control}
                value={choice}
                className="w-full"
                onChange={(event) => setChoice(event.target.value)}
              >
                <NativeSelectOption value="">{dictionary.choose_placeholder}</NativeSelectOption>
                {suggestions.map((item) => (
                  <NativeSelectOption key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="language-custom" label={dictionary.custom_code} description={dictionary.custom_code_hint}>
            {(control) => (
              <Input
                {...control}
                value={custom}
                autoComplete="off"
                maxLength={6}
                onChange={(event) => setCustom(event.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common.cancel}
            </Button>
            <Button type="submit" disabled={!is_valid || is_pending}>
              {is_pending && <Spinner />}
              {dictionary.add_confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
