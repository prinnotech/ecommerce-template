"use client";

import { ExternalLinkIcon, FileTextIcon, MoreHorizontalIcon, PaintbrushIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PageDialog } from "./page-dialog";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { EmptyState } from "@repo/admin-ui/components/empty-state";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { StorePage } from "@repo/core/actions/pages";
import { isLocale, LOCALES } from "@repo/core/i18nConfig";
import { useDeletePage, usePages } from "@repo/core/hooks/use-pages";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { formatDate } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

type PagesScreenProps = {
  lang: string;
  store_url: string;
  can_edit: boolean;
  can_customize: boolean;
  dictionary: AdminDictionary["custom_pages"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

export function PagesScreen({
  lang,
  store_url,
  can_edit,
  can_customize,
  dictionary,
  common,
  errors,
  validation,
}: PagesScreenProps) {
  const pages = usePages();
  const remove = useDeletePage();
  // "new" = the create dialog; a page = its settings dialog. Kept while the dialogs fade out.
  const [editing, setEditing] = useState<StorePage | "new" | null>(null);
  const [is_dialog_open, setIsDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<StorePage | null>(null);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const locale = isLocale(lang) ? lang : LOCALES[0];
  const title = (page: StorePage) => localized(page.title, locale) || page.slug;

  function openDialog(target: StorePage | "new") {
    setEditing(target);
    setIsDialogOpen(true);
  }

  const new_button = can_edit && (
    <Button type="button" onClick={() => openDialog("new")}>
      <PlusIcon />
      {dictionary.add}
    </Button>
  );

  if (pages.isPending) {
    return (
      <Page title={dictionary.title} subtitle={dictionary.subtitle}>
        <Skeleton className="h-48 rounded-xl" />
      </Page>
    );
  }
  if (pages.isError) {
    return (
      <Page title={dictionary.title}>
        <p className="text-destructive text-sm">{errorText(errors, pages.error)}</p>
      </Page>
    );
  }

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} primary_action={pages.data.length > 0 && new_button}>
      {pages.data.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title={dictionary.empty_title}
          body={dictionary.empty_body}
          action={new_button || undefined}
        />
      ) : (
        <SectionCard title={dictionary.list_title} is_flush>
          <ul className="divide-y border-t">
            {pages.data.map((page) => (
              <li key={page.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{title(page)}</span>
                    {page.is_published ? (
                      <StatusBadge tone="success">{dictionary.published}</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">{dictionary.hidden}</StatusBadge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    /pages/{page.slug} · {dictionary.edited.replace("{date}", formatDate(page.updated_at, lang))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {can_customize && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/themes/live?page=page:${page.id}`}>
                        <PaintbrushIcon />
                        {dictionary.edit_content}
                      </Link>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={dictionary.more}>
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {page.is_published && (
                        <DropdownMenuItem asChild>
                          <a
                            href={`${store_url}/${locale}/pages/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLinkIcon />
                            {dictionary.view}
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => openDialog(page)}>{dictionary.settings}</DropdownMenuItem>
                      {can_edit && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              setDeleting(page);
                              setIsDeleteOpen(true);
                            }}
                          >
                            {dictionary.delete}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <PageDialog
        page={editing === "new" ? null : editing}
        is_open={is_dialog_open}
        onOpenChange={setIsDialogOpen}
        lang={lang}
        can_edit={can_edit}
        dictionary={dictionary}
        common={common}
        errors={errors}
        validation={validation}
      />
      <ConfirmDialog
        is_open={is_delete_open}
        onOpenChange={setIsDeleteOpen}
        title={dictionary.delete_title.replace("{name}", deleting ? title(deleting) : "")}
        body={dictionary.delete_body}
        confirm_label={dictionary.delete}
        cancel_label={common.cancel}
        is_pending={remove.isPending}
        is_destructive
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(dictionary.deleted);
              setIsDeleteOpen(false);
            },
            onError: (error) => toast.error(errorText(errors, error)),
          });
        }}
      />
    </Page>
  );
}
