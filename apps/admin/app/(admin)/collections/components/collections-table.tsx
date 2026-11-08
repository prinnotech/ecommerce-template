"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { IndexTable, type IndexColumn } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { CollectionRow } from "@repo/core/actions/collections";
import { useCollections } from "@repo/core/hooks/use-collections";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";

type CollectionsTableProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["collections"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function CollectionsTable({ lang, can_edit, dictionary, index_table, errors }: CollectionsTableProps) {
  const collections = useCollections();
  const title = (row: CollectionRow) => localized(row.title, lang as Locale) || row.slug;

  const columns: IndexColumn<CollectionRow>[] = [
    {
      key: "title",
      header: dictionary.columns.title,
      is_primary: true,
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Thumbnail src={row.image_url} alt="" size="md" />
          <span className="truncate">{title(row)}</span>
        </span>
      ),
    },
    {
      key: "kind",
      header: dictionary.columns.kind,
      min_width: "sm",
      cell: (row) => dictionary.kinds[row.kind],
    },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (row) => (
        <StatusBadge tone={row.is_published ? "success" : "neutral"}>
          {row.is_published ? dictionary.published : dictionary.hidden}
        </StatusBadge>
      ),
    },
    {
      key: "products",
      header: dictionary.columns.products,
      align: "end",
      cell: (row) => formatPlural(row.product_count, dictionary.product_count, lang),
    },
  ];

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="full"
      primary_action={
        can_edit ? (
          <Button asChild>
            <Link href="/collections/new">
              <PlusIcon />
              {dictionary.create}
            </Link>
          </Button>
        ) : undefined
      }
    >
      <IndexTable
        lang={lang}
        rows={collections.data ?? []}
        getRowId={(row) => row.id}
        getRowHref={(row) => `/collections/${row.id}`}
        columns={columns}
        resource_label={dictionary.title}
        is_loading={collections.isFetching}
        empty_state={
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="font-medium">{dictionary.empty_title}</p>
            <p className="text-muted-foreground max-w-md text-sm">{dictionary.empty_body}</p>
          </div>
        }
        renderMobileRow={(row) => (
          <div className="flex items-center gap-3">
            <Thumbnail src={row.image_url} alt="" size="md" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{title(row)}</span>
              <span className="text-muted-foreground text-xs">
                {formatPlural(row.product_count, dictionary.product_count, lang)}
              </span>
            </div>
          </div>
        )}
        dictionary={index_table}
      />
      {collections.isError && <p className="text-destructive text-sm">{errorText(errors, collections.error)}</p>}
    </Page>
  );
}
