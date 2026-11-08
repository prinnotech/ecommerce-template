"use client";

import { DownloadIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { IndexTable, type BulkAction, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { ORDER_TONE, PAYMENT_TONE } from "@/components/order-status-tone";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { AdminOrderRow } from "@repo/core/actions/orders";
import { useAdminOrders, useBulkFulfillOrders, useExportOrders } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { order_list_filters_schema, type OrderListFilters } from "@repo/core/lib/schemas/orders";
import { formatCurrency, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";

const PAYMENT_FILTERS = ["unpaid", "paid", "refunded"] as const;

// Shopify's default order views, mapped onto the status/payment filters.
const VIEWS = [
  { key: "all", status: "all", payment: "all" },
  { key: "unfulfilled", status: "open", payment: "all" },
  { key: "unpaid", status: "all", payment: "unpaid" },
  { key: "open", status: "open", payment: "paid" },
  { key: "archived", status: "archived", payment: "all" },
] as const;

type OrdersTableProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["orders_admin"];
  order_status: AdminDictionary["order_status"];
  payment_status: AdminDictionary["payment_status"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function OrdersTable({
  lang,
  can_edit,
  dictionary,
  order_status,
  payment_status,
  index_table,
  errors,
}: OrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = order_list_filters_schema.parse(Object.fromEntries(search_params));
  const orders = useAdminOrders(filters);
  const fulfill = useBulkFulfillOrders();
  const export_orders = useExportOrders();

  // Filters live in the URL; any change but the page goes back to page 1.
  function setFilters(patch: Partial<OrderListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.payment !== "all") params.set("payment", next.payment);
    if (next.sort !== "created_at") params.set("sort", next.sort);
    if (next.direction !== "desc") params.set("direction", next.direction);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = VIEWS.map((view) => ({ key: view.key, label: dictionary.views[view.key] }));
  const active_view = VIEWS.find((view) => view.status === filters.status && view.payment === filters.payment)?.key;

  const columns: IndexColumn<AdminOrderRow>[] = [
    { key: "order", header: dictionary.columns.order, is_primary: true, cell: (order) => `#${order.order_number}` },
    {
      key: "date",
      header: dictionary.columns.date,
      min_width: "md",
      cell: (order) => formatDateTime(order.created_at, lang),
    },
    {
      key: "customer",
      header: dictionary.columns.customer,
      min_width: "sm",
      cell: (order) => (
        <span className="flex flex-col">
          <span className="truncate">{order.customer_name}</span>
          <span className="text-muted-foreground text-xs">{order.email}</span>
        </span>
      ),
    },
    {
      key: "payment",
      header: dictionary.columns.payment,
      min_width: "md",
      cell: (order) => (
        <StatusBadge tone={PAYMENT_TONE[order.payment_status]}>{payment_status[order.payment_status]}</StatusBadge>
      ),
    },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (order) => <StatusBadge tone={ORDER_TONE[order.status]}>{order_status[order.status]}</StatusBadge>,
    },
    {
      key: "items",
      header: dictionary.columns.items,
      align: "end",
      min_width: "md",
      cell: (order) => formatPlural(order.item_count, dictionary.items_count, lang),
    },
    {
      key: "total",
      header: dictionary.columns.total,
      align: "end",
      cell: (order) => formatCurrency(order.total, order.currency, lang),
    },
  ];

  const sort_options = [
    { key: "created_at", label: dictionary.columns.date },
    { key: "order_number", label: dictionary.columns.order },
    { key: "total", label: dictionary.columns.total },
  ];

  const bulk_actions: BulkAction[] = can_edit
    ? [{ key: "fulfill", label: dictionary.bulk_fulfill, onSelect: handleFulfill }]
    : [];

  function handleFulfill(ids: string[]) {
    fulfill.mutate(
      { ids },
      {
        onSuccess: (result) => toast.success(formatPlural(result.fulfilled, dictionary.bulk_fulfilled, lang)),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function handleExport() {
    export_orders.mutate(filters, {
      onSuccess: (csv) => {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = dictionary.export_filename;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  function renderMobileRow(order: AdminOrderRow) {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">
            #{order.order_number} · {order.customer_name}
          </span>
          <span className="shrink-0 tabular-nums">{formatCurrency(order.total, order.currency, lang)}</span>
        </span>
        <span className="text-muted-foreground text-xs">{formatDateTime(order.created_at, lang)}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={ORDER_TONE[order.status]}>{order_status[order.status]}</StatusBadge>
          <StatusBadge tone={PAYMENT_TONE[order.payment_status]}>{payment_status[order.payment_status]}</StatusBadge>
        </div>
      </div>
    );
  }

  return (
    <Page
      title={dictionary.title}
      width="full"
      secondary_actions={
        <Button type="button" variant="outline" onClick={handleExport} disabled={export_orders.isPending}>
          {export_orders.isPending ? <Spinner aria-hidden /> : <DownloadIcon />}
          {dictionary.export}
        </Button>
      }
    >
      <IndexTable
        lang={lang}
        rows={orders.data?.items ?? []}
        getRowId={(order) => order.id}
        getRowHref={(order) => `/orders/${order.id}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={active_view}
        onViewChange={(key) => {
          const view = VIEWS.find((candidate) => candidate.key === key);
          if (view) setFilters({ status: view.status, payment: view.payment });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        filter_controls={
          <NativeSelect
            aria-label={dictionary.payment_filter}
            value={filters.payment}
            onChange={(event) => setFilters({ payment: event.target.value as OrderListFilters["payment"] })}
            className="h-8"
          >
            <NativeSelectOption value="all">{dictionary.all_payments}</NativeSelectOption>
            {PAYMENT_FILTERS.map((payment) => (
              <NativeSelectOption key={payment} value={payment}>
                {payment_status[payment]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
        sort_options={sort_options}
        sort={{ key: filters.sort, direction: filters.direction }}
        onSortChange={(sort) => setFilters({ sort: sort.key as OrderListFilters["sort"], direction: sort.direction })}
        bulk_actions={bulk_actions}
        page={orders.data?.page ?? filters.page}
        total_pages={orders.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={orders.data ? formatPlural(orders.data.total_items, dictionary.results, lang) : undefined}
        is_loading={orders.isFetching}
        empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>}
        renderMobileRow={renderMobileRow}
        dictionary={index_table}
      />
      {orders.isError && <p className="text-destructive text-sm">{errorText(errors, orders.error)}</p>}
    </Page>
  );
}
