"use client";

import { DownloadIcon, FilterIcon, PencilIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SegmentDialog } from "./segment-dialog";

import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { AdminCustomerRow } from "@repo/core/actions/customers";
import { useCustomers, useExportCustomers, useSegments } from "@repo/core/hooks/use-customers";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { customer_list_filters_schema, type CustomerListFilters } from "@repo/core/lib/schemas/customers";
import type { Segment } from "@repo/core/lib/schemas/segments";
import { formatCurrency, formatDate, formatNumber, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";

const TYPES = ["all", "registered", "guest", "subscribed"] as const;
const SORTS = ["last_order", "total_spent", "order_count", "created_at"] as const;

type CustomersTableProps = {
  lang: string;
  currency: string;
  // Create and edit segments (customers.edit).
  can_edit: boolean;
  dictionary: AdminDictionary["customers"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

const SEGMENT_VIEW = "segment:";

export function CustomersTable({ lang, currency, can_edit, dictionary, index_table, errors }: CustomersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = customer_list_filters_schema.parse(Object.fromEntries(search_params));
  const customers = useCustomers(filters);
  const segments = useSegments();
  const export_customers = useExportCustomers();
  // "new" = creating a segment; a segment = editing it.
  const [editing, setEditing] = useState<Segment | "new" | null>(null);
  const active_segment = (segments.data ?? []).find((segment) => segment.id === filters.segment) ?? null;

  // Filters live in the URL; any change but the page goes back to page 1.
  function setFilters(patch: Partial<CustomerListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.type !== "all") params.set("type", next.type);
    if (next.segment) params.set("segment", next.segment);
    if (next.sort !== "last_order") params.set("sort", next.sort);
    if (next.direction !== "desc") params.set("direction", next.direction);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const money = (customer: AdminCustomerRow) =>
    formatCurrency(customer.total_spent, customer.currency || currency, lang);
  // The built-in views, then one per saved segment.
  const views: IndexView[] = [
    ...TYPES.map((type) => ({ key: type, label: dictionary.types[type] })),
    ...(segments.data ?? []).map((segment) => ({ key: `${SEGMENT_VIEW}${segment.id}`, label: segment.name })),
  ];

  function handleExport() {
    export_customers.mutate(filters, {
      onSuccess: (csv) => {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = dictionary.export_filename;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  const columns: IndexColumn<AdminCustomerRow>[] = [
    {
      key: "customer",
      header: dictionary.columns.customer,
      is_primary: true,
      cell: (customer) => (
        <span className="flex flex-col">
          <span>{customer.name || customer.email}</span>
          {customer.name && <span className="text-muted-foreground text-xs font-normal">{customer.email}</span>}
        </span>
      ),
    },
    {
      key: "type",
      header: dictionary.columns.type,
      min_width: "md",
      cell: (customer) => (
        <StatusBadge tone={customer.is_registered ? "info" : "neutral"}>
          {customer.is_registered ? dictionary.types.registered : dictionary.types.guest}
        </StatusBadge>
      ),
    },
    {
      key: "orders",
      header: dictionary.columns.orders,
      align: "end",
      cell: (customer) => formatNumber(customer.order_count, lang),
    },
    { key: "spent", header: dictionary.columns.spent, align: "end", cell: money },
    {
      key: "last_order",
      header: dictionary.columns.last_order,
      min_width: "lg",
      className: "text-muted-foreground",
      cell: (customer) =>
        customer.last_order_at ? formatDate(customer.last_order_at, lang) : dictionary.no_orders_yet,
    },
  ];

  function renderMobileRow(customer: AdminCustomerRow) {
    return (
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{customer.name || customer.email}</span>
          <span className="text-muted-foreground text-xs">
            {formatPlural(customer.order_count, dictionary.order_count, lang)}
          </span>
        </span>
        <span className="shrink-0 tabular-nums">{money(customer)}</span>
      </div>
    );
  }

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="full"
      secondary_actions={
        <>
          <Button type="button" variant="outline" disabled={export_customers.isPending} onClick={handleExport}>
            <DownloadIcon />
            {dictionary.export}
          </Button>
          {can_edit && active_segment && (
            <Button type="button" variant="outline" onClick={() => setEditing(active_segment)}>
              <PencilIcon />
              {dictionary.segments.edit}
            </Button>
          )}
        </>
      }
      primary_action={
        can_edit ? (
          <Button type="button" onClick={() => setEditing("new")}>
            <FilterIcon />
            {dictionary.segments.create}
          </Button>
        ) : undefined
      }
    >
      <IndexTable
        lang={lang}
        rows={customers.data?.items ?? []}
        getRowId={(customer) => customer.key}
        getRowHref={(customer) => `/customers/${customer.key}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.segment ? `${SEGMENT_VIEW}${filters.segment}` : filters.type}
        onViewChange={(key) =>
          key.startsWith(SEGMENT_VIEW)
            ? setFilters({ type: "all", segment: key.slice(SEGMENT_VIEW.length) })
            : setFilters({ type: key as CustomerListFilters["type"], segment: "" })
        }
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        sort_options={SORTS.map((key) => ({ key, label: dictionary.sort[key] }))}
        sort={{ key: filters.sort, direction: filters.direction }}
        onSortChange={(sort) =>
          setFilters({ sort: sort.key as CustomerListFilters["sort"], direction: sort.direction })
        }
        page={customers.data?.page ?? filters.page}
        total_pages={customers.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={customers.data ? formatPlural(customers.data.total_items, dictionary.results, lang) : undefined}
        is_loading={customers.isFetching}
        empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>}
        renderMobileRow={renderMobileRow}
        dictionary={index_table}
      />
      {customers.isError && <p className="text-destructive text-sm">{errorText(errors, customers.error)}</p>}
      <SegmentDialog
        lang={lang}
        currency={currency}
        segment={editing === "new" ? null : editing}
        is_open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={(id) => setFilters({ type: "all", segment: id })}
        onDeleted={() => setFilters({ segment: "" })}
        dictionary={dictionary.segments}
        errors={errors}
      />
    </Page>
  );
}
