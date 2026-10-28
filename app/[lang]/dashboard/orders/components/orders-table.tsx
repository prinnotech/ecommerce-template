"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";

import { OrderRows } from "@/components/dashboard/order-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOrders } from "@/hooks/use-orders";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { order_list_filters_schema, type OrderListFilters } from "@/lib/schemas/orders";
import { cn } from "@/lib/utils";

const STATUS_TABS = ["all", "open", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
const PAYMENT_FILTERS = ["unpaid", "paid", "refunded"] as const;

type OrdersTableProps = {
  lang: string;
  dictionary: Dictionary["orders_admin"];
  order_status: Dictionary["order_status"];
  payment_status: Dictionary["payment_status"];
  errors: Dictionary["errors"];
};

export function OrdersTable({ lang, dictionary, order_status, payment_status, errors }: OrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = order_list_filters_schema.parse(Object.fromEntries(search_params));
  const orders = useAdminOrders(filters);
  const is_filtered = filters.search !== "" || filters.status !== "all" || filters.payment !== "all";

  // Filters live in the URL; any change goes back to page 1.
  function setFilters(patch: Partial<OrderListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.payment !== "all") params.set("payment", next.payment);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ search: String(new FormData(event.currentTarget).get("search") ?? "").trim() });
  }

  const tabLabel = (tab: (typeof STATUS_TABS)[number]) =>
    tab === "all" ? dictionary.all : tab === "open" ? dictionary.open : order_status[tab];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.title}</h1>

      <div className="flex flex-col gap-3">
        <div className="-mx-4 overflow-x-auto px-4">
          <div role="group" aria-label={dictionary.tabs_label} className="flex w-max gap-1 border-b">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={filters.status === tab}
                onClick={() => setFilters({ status: tab })}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  filters.status === tab
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form onSubmit={onSearch} role="search" className="relative flex-1 sm:max-w-sm">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              key={filters.search}
              name="search"
              type="search"
              aria-label={dictionary.search}
              placeholder={dictionary.search_placeholder}
              defaultValue={filters.search}
              className="pl-8"
            />
          </form>
          <NativeSelect
            aria-label={dictionary.payment_filter}
            value={filters.payment}
            onChange={(event) => setFilters({ payment: event.target.value as OrderListFilters["payment"] })}
          >
            <NativeSelectOption value="all">{dictionary.all_payments}</NativeSelectOption>
            {PAYMENT_FILTERS.map((payment) => (
              <NativeSelectOption key={payment} value={payment}>
                {payment_status[payment]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card className={cn("py-0", orders.isFetching && !orders.isPending && "opacity-70 transition-opacity")}>
        {orders.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : orders.isError ? (
          <p className="text-destructive p-6 text-sm">{errorText(errors, orders.error)}</p>
        ) : orders.data.items.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            {is_filtered ? dictionary.empty_filtered : dictionary.empty}
          </p>
        ) : (
          <OrderRows
            lang={lang}
            orders={orders.data.items}
            dictionary={dictionary}
            order_status={order_status}
            payment_status={payment_status}
          />
        )}
      </Card>

      {orders.data && orders.data.total_items > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            {dictionary.results.replace("{count}", String(orders.data.total_items))}
          </span>
          {orders.data.total_pages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {dictionary.page_of
                  .replace("{page}", String(orders.data.page))
                  .replace("{total}", String(orders.data.total_pages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
              >
                {dictionary.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= orders.data.total_pages}
                onClick={() => setFilters({ page: filters.page + 1 })}
              >
                {dictionary.next}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
