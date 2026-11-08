"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { AdminDiscount } from "@repo/core/backend/types";
import { useDiscounts } from "@repo/core/hooks/use-discounts";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  DISCOUNT_STATUSES,
  discount_list_filters_schema,
  discountStatus,
  type DiscountListFilters,
  type DiscountStatus,
} from "@repo/core/lib/schemas/discounts";
import { formatCurrency, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";

export const DISCOUNT_TONE: Record<DiscountStatus, StatusTone> = {
  active: "success",
  scheduled: "info",
  expired: "neutral",
  used_up: "neutral",
  disabled: "attention",
};

type DiscountsTableProps = {
  lang: string;
  currency: string;
  can_edit: boolean;
  dictionary: AdminDictionary["discounts"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

// "10% off", "€5.00 off", "Free shipping" — the same words the editor's summary uses.
export function discountValueText(
  discount: Pick<AdminDiscount, "type" | "value">,
  currency: string,
  lang: string,
  dictionary: AdminDictionary["discounts"],
): string {
  if (discount.type === "free_shipping") return dictionary.types.free_shipping;
  const amount = discount.type === "percent" ? `${discount.value}%` : formatCurrency(discount.value, currency, lang);
  return dictionary.value_off.replace("{amount}", amount);
}

export function DiscountsTable({ lang, currency, can_edit, dictionary, index_table, errors }: DiscountsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = discount_list_filters_schema.parse(Object.fromEntries(search_params));
  const discounts = useDiscounts(filters);

  function setFilters(patch: Partial<DiscountListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = [
    { key: "all", label: dictionary.all },
    ...DISCOUNT_STATUSES.map((status) => ({ key: status, label: dictionary.status[status] })),
  ];

  const columns: IndexColumn<AdminDiscount>[] = [
    {
      key: "code",
      header: dictionary.columns.code,
      is_primary: true,
      cell: (discount) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-sm font-medium">{discount.code}</span>
          {discount.title && <span className="text-muted-foreground truncate text-xs">{discount.title}</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (discount) => {
        const status = discountStatus(discount);
        return <StatusBadge tone={DISCOUNT_TONE[status]}>{dictionary.status[status]}</StatusBadge>;
      },
    },
    {
      key: "value",
      header: dictionary.columns.value,
      cell: (discount) => discountValueText(discount, currency, lang, dictionary),
    },
    {
      key: "used",
      header: dictionary.columns.used,
      align: "end",
      min_width: "md",
      cell: (discount) =>
        discount.usage_limit > 0 ? `${discount.used_count} / ${discount.usage_limit}` : String(discount.used_count),
    },
  ];

  return (
    <Page
      title={dictionary.title}
      width="full"
      primary_action={
        can_edit ? (
          <Button asChild>
            <Link href="/discounts/new">
              <PlusIcon />
              {dictionary.create}
            </Link>
          </Button>
        ) : undefined
      }
    >
      <IndexTable
        lang={lang}
        rows={discounts.data?.items ?? []}
        getRowId={(discount) => discount.id}
        getRowHref={(discount) => `/discounts/${discount.id}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.status}
        onViewChange={(key) => {
          const status = key === "all" ? "all" : DISCOUNT_STATUSES.find((item) => item === key);
          if (status) setFilters({ status });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        page={discounts.data?.page ?? filters.page}
        total_pages={discounts.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={discounts.data ? formatPlural(discounts.data.total_items, dictionary.results, lang) : undefined}
        is_loading={discounts.isFetching}
        empty_state={
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="font-medium">{dictionary.empty_title}</p>
            <p className="text-muted-foreground max-w-md text-sm">{dictionary.empty_body}</p>
          </div>
        }
        renderMobileRow={(discount) => {
          const status = discountStatus(discount);
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-mono text-sm font-medium">{discount.code}</span>
                <StatusBadge tone={DISCOUNT_TONE[status]}>{dictionary.status[status]}</StatusBadge>
              </div>
              <span className="text-sm">{discountValueText(discount, currency, lang, dictionary)}</span>
            </div>
          );
        }}
        dictionary={index_table}
      />
      {discounts.isError && <p className="text-destructive text-sm">{errorText(errors, discounts.error)}</p>}
    </Page>
  );
}
