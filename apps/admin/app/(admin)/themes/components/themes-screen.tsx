"use client";

import { ExternalLinkIcon, MoreHorizontalIcon, PaintbrushIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RenameThemeDialog } from "./rename-theme-dialog";
import { ThemeThumbnail } from "@/components/themes/theme-thumbnail";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { ThemeSummary } from "@repo/core/actions/themes";
import {
  useAddTheme,
  useDeleteTheme,
  useDuplicateTheme,
  usePublishTheme,
  useThemes,
} from "@repo/core/hooks/use-themes";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { formatDate, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type ThemesScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["themes"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

type PendingConfirm = { kind: "publish" | "delete"; theme: ThemeSummary };

export function ThemesScreen({ lang, can_edit, dictionary, common, errors, validation }: ThemesScreenProps) {
  const router = useRouter();
  const themes = useThemes();
  const add = useAddTheme();
  const duplicate = useDuplicateTheme();
  const publish = usePublishTheme();
  const remove = useDeleteTheme();
  const [renaming, setRenaming] = useState<ThemeSummary | null>(null);
  const [is_rename_open, setIsRenameOpen] = useState(false);
  // The theme stays set while the dialog fades out, so its title doesn't go blank.
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [is_confirm_open, setIsConfirmOpen] = useState(false);
  const [adding_template, setAddingTemplate] = useState<string | null>(null);

  const onError = (error: unknown) => toast.error(errorText(errors, error));

  if (themes.isPending) {
    return (
      <Page title={dictionary.title} subtitle={dictionary.subtitle}>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </Page>
    );
  }
  if (themes.isError) {
    return (
      <Page title={dictionary.title}>
        <p className="text-destructive text-sm">{errorText(errors, themes.error)}</p>
      </Page>
    );
  }

  const { themes: list, templates, store_url } = themes.data;
  const live = list.find((theme) => theme.is_live);
  const library = list.filter((theme) => !theme.is_live);
  const templateName = (id: string) => templates.find((template) => template.id === id)?.name ?? id;
  const editorHref = (theme: ThemeSummary) => `/themes/${theme.id}`;

  function openConfirm(kind: PendingConfirm["kind"], theme: ThemeSummary) {
    setConfirm({ kind, theme });
    setIsConfirmOpen(true);
  }

  function onConfirm() {
    if (!confirm) return;
    const { kind, theme } = confirm;
    if (kind === "publish") {
      publish.mutate(theme.id, {
        onSuccess: (result) => {
          toast.success(
            (result.is_store_refreshed ? dictionary.published : dictionary.published_slow).replace(
              "{name}",
              theme.name,
            ),
          );
          setIsConfirmOpen(false);
        },
        onError,
      });
      return;
    }
    remove.mutate(theme.id, {
      onSuccess: () => {
        toast.success(dictionary.deleted);
        setIsConfirmOpen(false);
      },
      onError,
    });
  }

  function addTemplate(id: string) {
    setAddingTemplate(id);
    add.mutate(id, {
      onSuccess: (theme) => {
        toast.success(dictionary.added.replace("{name}", theme.name));
        router.push(editorHref(theme));
      },
      onError,
      onSettled: () => setAddingTemplate(null),
    });
  }

  function status(theme: ThemeSummary) {
    if (!theme.published_at) return dictionary.never_published;
    return dictionary.published_on.replace("{date}", formatDate(theme.published_at, lang));
  }

  function actionsMenu(theme: ThemeSummary) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={dictionary.more}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!theme.is_live && (
            <DropdownMenuItem onSelect={() => openConfirm("publish", theme)}>{dictionary.publish}</DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setRenaming(theme);
              setIsRenameOpen(true);
            }}
          >
            {dictionary.rename}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={duplicate.isPending}
            onSelect={() =>
              duplicate.mutate(theme.id, { onSuccess: () => toast.success(dictionary.duplicated), onError })
            }
          >
            {dictionary.duplicate}
          </DropdownMenuItem>
          {!theme.is_live && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => openConfirm("delete", theme)}>
                {dictionary.delete}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      secondary_actions={
        <Button asChild variant="outline">
          <a href={store_url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            {dictionary.view_store}
          </a>
        </Button>
      }
    >
      {live && (
        <SectionCard title={dictionary.current_title}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ThemeThumbnail settings={live.settings} className="w-full sm:w-72" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{live.name}</h2>
                <StatusBadge tone="success">{dictionary.live}</StatusBadge>
                {live.has_unpublished_changes && (
                  <StatusBadge tone="attention">{dictionary.unpublished_changes}</StatusBadge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {dictionary.template_label.replace("{name}", templateName(live.template))} · {status(live)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild>
                  <Link href={editorHref(live)}>
                    <PaintbrushIcon />
                    {dictionary.customize}
                  </Link>
                </Button>
                {can_edit && actionsMenu(live)}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title={dictionary.library_title} description={dictionary.library_hint} is_flush>
        {library.length === 0 ? (
          <p className="text-muted-foreground border-t px-5 py-6 text-sm">{dictionary.library_empty}</p>
        ) : (
          <ul className="divide-y border-t">
            {library.map((theme) => (
              <li key={theme.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <ThemeThumbnail settings={theme.settings} className="w-28 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{theme.name}</span>
                    {theme.has_unpublished_changes && theme.published_at && (
                      <StatusBadge tone="attention">{dictionary.unpublished_changes}</StatusBadge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {dictionary.template_label.replace("{name}", templateName(theme.template))} ·{" "}
                    {dictionary.edited.replace("{time}", formatDate(theme.updated_at, lang))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={editorHref(theme)}>{dictionary.customize}</Link>
                  </Button>
                  {can_edit && actionsMenu(theme)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{dictionary.gallery_title}</h2>
          <p className="text-muted-foreground text-sm">{dictionary.gallery_hint}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <li key={template.id} className="bg-card flex flex-col gap-3 rounded-xl border p-3">
              <ThemeThumbnail settings={template.settings} />
              <div className="flex flex-1 flex-col gap-1 px-1">
                <span className="font-medium">{template.name}</span>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {dictionary.templates[template.id as keyof AdminDictionary["themes"]["templates"]] ?? ""}
                </p>
                <span className="text-muted-foreground text-xs">
                  {formatPlural(template.section_count, dictionary.sections_count, lang)}
                </span>
              </div>
              {can_edit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={add.isPending}
                  onClick={() => addTemplate(template.id)}
                >
                  {adding_template === template.id ? <Spinner /> : <PlusIcon />}
                  {dictionary.add}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <RenameThemeDialog
        theme={renaming}
        is_open={is_rename_open}
        onOpenChange={setIsRenameOpen}
        dictionary={dictionary}
        common={common}
        errors={errors}
        validation={validation}
      />
      <ConfirmDialog
        is_open={is_confirm_open}
        onOpenChange={setIsConfirmOpen}
        title={(confirm?.kind === "delete" ? dictionary.delete_title : dictionary.publish_title).replace(
          "{name}",
          confirm?.theme.name ?? "",
        )}
        body={confirm?.kind === "delete" ? dictionary.delete_body : dictionary.publish_body}
        confirm_label={confirm?.kind === "delete" ? dictionary.delete : dictionary.publish}
        cancel_label={common.cancel}
        onConfirm={onConfirm}
        is_pending={publish.isPending || remove.isPending}
        is_destructive={confirm?.kind === "delete"}
      />
    </Page>
  );
}
