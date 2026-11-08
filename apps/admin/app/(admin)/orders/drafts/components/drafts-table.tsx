"use client";

import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { DraftOrderRow } from "@repo/core/backend/types";
import { useCreateDraftOrder, useDraftOrders } from "@repo/core/hooks/use-draft-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  DRAFT_STATUSES,
  draft_list_filters_schema,
  type DraftListFilters,
  type DraftStatus,
} from "@repo/core/lib/schemas/draft-orders";
import { formatCurrency, formatDate, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";

export const DRAFT_TONE: Record<DraftStatus, StatusTone> = {
  open: "info",
  invoice_sent: "attention",
  completed: "success",
};

type DraftsTableProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["draft_orders"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function DraftsTable({ lang, can_edit, dictionary, index_table, errors }: DraftsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = draft_list_filters_schema.parse(Object.fromEntries(search_params));
  const drafts = useDraftOrders(filters);
  const create = useCreateDraftOrder();

  function setFilters(patch: Partial<DraftListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function createDraft() {
    create.mutate(undefined, {
      onSuccess: ({ id }) => router.push(`/orders/drafts/${id}`),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  const views: IndexView[] = [
    { key: "all", label: dictionary.all },
    ...DRAFT_STATUSES.map((status) => ({ key: status, label: dictionary.status[status] })),
  ];
  const customer = (draft: DraftOrderRow) => draft.customer_name || draft.email || "—";

  const columns: IndexColumn<DraftOrderRow>[] = [
    {
      key: "draft",
      header: dictionary.columns.draft,
      is_primary: true,
      cell: (draft) => <span className="font-medium">{`D${draft.draft_number}`}</span>,
    },
    {
      key: "date",
      header: dictionary.columns.date,
      min_width: "sm",
      cell: (draft) => formatDate(draft.created_at, lang),
    },
    { key: "customer", header: dictionary.columns.customer, cell: customer },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (draft) => <StatusBadge tone={DRAFT_TONE[draft.status]}>{dictionary.status[draft.status]}</StatusBadge>,
    },
    {
      key: "total",
      header: dictionary.columns.total,
      align: "end",
      cell: (draft) => formatCurrency(draft.total, draft.currency, lang),
    },
  ];

  return (
    <Page
      title={dictionary.title}
      width="full"
      primary_action={
        can_edit ? (
          <Button type="button" onClick={createDraft} disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <PlusIcon />}
            {dictionary.create}
          </Button>
        ) : undefined
      }
    >
      <IndexTable
        lang={lang}
        rows={drafts.data?.items ?? []}
        getRowId={(draft) => draft.id}
        getRowHref={(draft) => `/orders/drafts/${draft.id}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.status}
        onViewChange={(key) => {
          const status = key === "all" ? "all" : DRAFT_STATUSES.find((item) => item === key);
          if (status) setFilters({ status });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        page={drafts.data?.page ?? filters.page}
        total_pages={drafts.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={drafts.data ? formatPlural(drafts.data.total_items, dictionary.results, lang) : undefined}
        is_loading={drafts.isFetching}
        empty_state={
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="font-medium">{dictionary.empty_title}</p>
            <p className="text-muted-foreground max-w-md text-sm">{dictionary.empty_body}</p>
          </div>
        }
        renderMobileRow={(draft) => (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">{`D${draft.draft_number} · ${customer(draft)}`}</span>
              <StatusBadge tone={DRAFT_TONE[draft.status]}>{dictionary.status[draft.status]}</StatusBadge>
            </div>
            <span className="text-sm tabular-nums">{formatCurrency(draft.total, draft.currency, lang)}</span>
          </div>
        )}
        dictionary={index_table}
      />
      {drafts.isError && <p className="text-destructive text-sm">{errorText(errors, drafts.error)}</p>}
    </Page>
  );
}
