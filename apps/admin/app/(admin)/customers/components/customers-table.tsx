"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { AdminCustomerRow } from "@repo/core/actions/customers";
import { useCustomers } from "@repo/core/hooks/use-customers";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { customer_list_filters_schema, type CustomerListFilters } from "@repo/core/lib/schemas/customers";
import { formatCurrency, formatDate, formatNumber, formatPlural } from "@repo/core/lib/utils/format";

const TYPES = ["all", "registered", "guest", "subscribed"] as const;
const SORTS = ["last_order", "total_spent", "order_count", "created_at"] as const;

type CustomersTableProps = {
  lang: string;
  currency: string;
  dictionary: AdminDictionary["customers"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function CustomersTable({ lang, currency, dictionary, index_table, errors }: CustomersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = customer_list_filters_schema.parse(Object.fromEntries(search_params));
  const customers = useCustomers(filters);

  // Filters live in the URL; any change but the page goes back to page 1.
  function setFilters(patch: Partial<CustomerListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.type !== "all") params.set("type", next.type);
    if (next.sort !== "last_order") params.set("sort", next.sort);
    if (next.direction !== "desc") params.set("direction", next.direction);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const money = (customer: AdminCustomerRow) =>
    formatCurrency(customer.total_spent, customer.currency || currency, lang);
  const views: IndexView[] = TYPES.map((type) => ({ key: type, label: dictionary.types[type] }));

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
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full">
      <IndexTable
        lang={lang}
        rows={customers.data?.items ?? []}
        getRowId={(customer) => customer.key}
        getRowHref={(customer) => `/customers/${customer.key}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.type}
        onViewChange={(key) => setFilters({ type: key as CustomerListFilters["type"] })}
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
    </Page>
  );
}
