"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { IndexTable, type IndexColumn } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { ActivityRow } from "@repo/core/actions/activity";
import { useActivityLog } from "@repo/core/hooks/use-activity";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { activity_filters_schema, type ActivityFilters } from "@repo/core/lib/schemas/admin";
import { formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";

type ActivityLogProps = {
  lang: string;
  dictionary: AdminDictionary["activity"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function ActivityLog({ lang, dictionary, index_table, errors }: ActivityLogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = activity_filters_schema.parse(Object.fromEntries(search_params));
  const log = useActivityLog(filters);

  function setFilters(patch: Partial<ActivityFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.result !== "all") params.set("result", next.result);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // Actions are stored as fixed English phrases ("import products"); show the translated label,
  // or the stored text for an action without one (older rows, new actions).
  function actionLabel(action: string): string {
    const key = action
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    return (dictionary.actions as Record<string, string>)[key] ?? action;
  }

  const columns: IndexColumn<ActivityRow>[] = [
    {
      key: "time",
      header: dictionary.columns.time,
      min_width: "sm",
      cell: (row) => formatDateTime(row.created_at, lang),
    },
    {
      key: "actor",
      header: dictionary.columns.actor,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="truncate">{row.actor_name || row.actor_email}</span>
          <span className="text-muted-foreground text-xs">{row.actor_email}</span>
        </span>
      ),
    },
    { key: "action", header: dictionary.columns.action, is_primary: true, cell: (row) => actionLabel(row.action) },
    {
      key: "result",
      header: dictionary.columns.result,
      align: "end",
      cell: (row) =>
        row.is_denied ? (
          <StatusBadge tone="critical">{dictionary.denied}</StatusBadge>
        ) : (
          <StatusBadge tone="success">{dictionary.allowed}</StatusBadge>
        ),
    },
  ];

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full">
      <IndexTable
        lang={lang}
        rows={log.data?.items ?? []}
        getRowId={(row) => row.id}
        columns={columns}
        resource_label={dictionary.title}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        filter_controls={
          <NativeSelect
            aria-label={dictionary.result_filter}
            value={filters.result}
            onChange={(event) => setFilters({ result: event.target.value as ActivityFilters["result"] })}
            className="h-8"
          >
            <NativeSelectOption value="all">{dictionary.all_results}</NativeSelectOption>
            <NativeSelectOption value="denied">{dictionary.denied_only}</NativeSelectOption>
          </NativeSelect>
        }
        page={log.data?.page ?? filters.page}
        total_pages={log.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={log.data ? formatPlural(log.data.total_items, dictionary.results, lang) : undefined}
        is_loading={log.isFetching}
        empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>}
        dictionary={index_table}
      />
      {log.isError && <p className="text-destructive text-sm">{errorText(errors, log.error)}</p>}
    </Page>
  );
}
