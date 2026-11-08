"use client";

import { SendIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { AbandonedCheckoutRow } from "@repo/core/backend/types";
import { useAbandonedCheckouts, useSendAbandonedCheckoutEmail } from "@repo/core/hooks/use-abandoned-checkouts";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  abandoned_checkout_filters_schema,
  type AbandonedCheckoutFilters,
} from "@repo/core/lib/schemas/abandoned-checkouts";
import { formatCurrency, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";

const VIEWS = ["all", "not_sent", "sent"] as const;

type AbandonedTableProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["abandoned"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function AbandonedTable({ lang, can_edit, dictionary, index_table, errors }: AbandonedTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = abandoned_checkout_filters_schema.parse(Object.fromEntries(search_params));
  const page = useAbandonedCheckouts(filters);
  const send = useSendAbandonedCheckoutEmail();
  const can_send = can_edit && Boolean(page.data?.is_smtp_configured);

  function setFilters(patch: Partial<AbandonedCheckoutFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.recovery !== "all") params.set("recovery", next.recovery);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function sendEmail(row: AbandonedCheckoutRow) {
    send.mutate(row.id, {
      onSuccess: () => toast.success(dictionary.sent_toast.replace("{email}", row.email)),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  function sendButton(row: AbandonedCheckoutRow) {
    const is_sending = send.isPending && send.variables === row.id;
    return (
      <Button type="button" variant="outline" size="sm" disabled={is_sending} onClick={() => sendEmail(row)}>
        {is_sending ? <Spinner /> : <SendIcon />}
        {row.recovery_sent_at ? dictionary.send_again : dictionary.send}
      </Button>
    );
  }

  const views: IndexView[] = VIEWS.map((key) => ({ key, label: dictionary.views[key] }));

  const columns: IndexColumn<AbandonedCheckoutRow>[] = [
    {
      key: "customer",
      header: dictionary.columns.customer,
      is_primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.email}</span>
          <span className="text-muted-foreground truncate text-xs">{row.items.join(", ")}</span>
        </span>
      ),
    },
    {
      key: "date",
      header: dictionary.columns.date,
      min_width: "md",
      cell: (row) => formatDateTime(row.contact_at, lang),
    },
    {
      key: "recovery",
      header: dictionary.columns.recovery,
      min_width: "sm",
      cell: (row) =>
        row.recovery_sent_at ? (
          <StatusBadge tone="success">
            {dictionary.recovery_sent.replace("{date}", formatDateTime(row.recovery_sent_at, lang))}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{dictionary.recovery_not_sent}</StatusBadge>
        ),
    },
    {
      key: "total",
      header: dictionary.columns.total,
      align: "end",
      cell: (row) => formatCurrency(row.total, row.currency, lang),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (can_send ? sendButton(row) : null),
    },
  ];

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full">
      {page.data && !page.data.is_smtp_configured && (
        <p className="bg-warning text-warning-foreground flex flex-wrap items-center gap-x-2 rounded-md px-4 py-3 text-sm">
          {dictionary.smtp_missing}
          <Link href="/settings/email" className="font-medium underline underline-offset-4">
            {dictionary.smtp_link}
          </Link>
        </p>
      )}
      {page.data?.is_smtp_configured && (
        <p className="text-muted-foreground text-sm">
          {page.data.delay_hours > 0
            ? dictionary.automatic_on.replace("{hours}", String(page.data.delay_hours))
            : dictionary.automatic_off}{" "}
          <Link href="/settings/notifications" className="underline underline-offset-4">
            {dictionary.automatic_link}
          </Link>
        </p>
      )}
      <IndexTable
        lang={lang}
        rows={page.data?.items ?? []}
        getRowId={(row) => row.id}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.recovery}
        onViewChange={(key) => {
          const recovery = VIEWS.find((item) => item === key);
          if (recovery) setFilters({ recovery });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        page={page.data?.page ?? filters.page}
        total_pages={page.data?.total_pages ?? 1}
        onPageChange={(next) => setFilters({ page: next })}
        summary={page.data ? formatPlural(page.data.total_items, dictionary.results, lang) : undefined}
        is_loading={page.isFetching}
        empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>}
        renderMobileRow={(row) => (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-medium">{row.email}</span>
              <span className="text-muted-foreground text-xs">{formatCurrency(row.total, row.currency, lang)}</span>
            </div>
            {can_send && sendButton(row)}
          </div>
        )}
        dictionary={index_table}
      />
      {page.isError && <p className="text-destructive text-sm">{errorText(errors, page.error)}</p>}
    </Page>
  );
}
