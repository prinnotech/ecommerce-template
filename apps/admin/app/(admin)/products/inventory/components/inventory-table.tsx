"use client";

import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StockDialog } from "./stock-dialog";
import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { InventoryRow } from "@repo/core/backend/types";
import { useAdminCategories } from "@repo/core/hooks/use-catalog";
import { useAdjustStock, useInventory } from "@repo/core/hooks/use-inventory";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import {
  inventory_filters_schema,
  MAX_STOCK,
  STOCK_FILTERS,
  type InventoryFilters,
} from "@repo/core/lib/schemas/inventory";
import { formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";

type InventoryTableProps = {
  lang: string;
  can_edit: boolean;
  can_filter_category: boolean;
  dictionary: AdminDictionary["inventory"];
  catalog: AdminDictionary["catalog"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

export function variantLabel(row: Pick<InventoryRow, "size" | "color">, fallback: string): string {
  return [row.size, row.color].filter(Boolean).join(" / ") || fallback;
}

export function InventoryTable({
  lang,
  can_edit,
  can_filter_category,
  dictionary,
  catalog,
  index_table,
  common,
  errors,
}: InventoryTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = inventory_filters_schema.parse(Object.fromEntries(search_params));
  const inventory = useInventory(filters);
  const categories = useAdminCategories();
  const locale = lang as Locale;
  const threshold = inventory.data?.low_stock_threshold ?? 0;
  const [open_row, setOpenRow] = useState<InventoryRow | null>(null);

  function setFilters(patch: Partial<InventoryFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.stock !== "all") params.set("stock", next.stock);
    if (next.category) params.set("category", next.category);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = STOCK_FILTERS.map((key) => ({ key, label: dictionary.views[key] }));
  const title = (row: InventoryRow) => localized(row.product_title, locale) || catalog.products.untitled;

  function stockBadge(row: InventoryRow) {
    if (row.stock <= 0) return <StatusBadge tone="critical">{dictionary.out_of_stock}</StatusBadge>;
    if (row.stock <= threshold) return <StatusBadge tone="attention">{dictionary.low_stock}</StatusBadge>;
    return null;
  }

  const columns: IndexColumn<InventoryRow>[] = [
    {
      key: "product",
      header: dictionary.columns.product,
      is_primary: true,
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Thumbnail src={row.image_url} alt="" size="md" />
          <span className="flex min-w-0 flex-col">
            <Link href={`/products/${row.product_id}`} className="truncate hover:underline">
              {title(row)}
            </Link>
            <span className="text-muted-foreground truncate text-xs">
              {variantLabel(row, dictionary.default_variant)}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "sku",
      header: dictionary.columns.sku,
      min_width: "md",
      cell: (row) => <span className="text-muted-foreground font-mono text-xs">{row.sku || "—"}</span>,
    },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (row) => (
        <span className="flex flex-wrap gap-1.5">
          {stockBadge(row)}
          {!row.is_active && <StatusBadge tone="neutral">{dictionary.inactive}</StatusBadge>}
        </span>
      ),
    },
    {
      key: "available",
      header: dictionary.columns.available,
      align: "end",
      cell: (row) =>
        can_edit ? (
          <StockInput
            key={`${row.variant_id}:${row.stock}`}
            row={row}
            label={dictionary.available_for}
            title={title(row)}
            dictionary={dictionary}
            errors={errors}
          />
        ) : (
          <span className="tabular-nums">{row.stock}</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpenRow(row)}>
          <HistoryIcon />
          <span className="sr-only md:not-sr-only">{can_edit ? dictionary.adjust : dictionary.history}</span>
        </Button>
      ),
    },
  ];

  function renderMobileRow(row: InventoryRow) {
    return (
      <div className="flex items-center gap-3">
        <Thumbnail src={row.image_url} alt="" size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={`/products/${row.product_id}`} className="truncate font-medium">
            {title(row)}
          </Link>
          <span className="text-muted-foreground truncate text-xs">
            {variantLabel(row, dictionary.default_variant)}
          </span>
          <span className="flex flex-wrap gap-1.5">{stockBadge(row)}</span>
        </div>
        <Button type="button" variant="outline" size="sm" className="tabular-nums" onClick={() => setOpenRow(row)}>
          {row.stock}
        </Button>
      </div>
    );
  }

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle.replace("{threshold}", String(threshold))}
      width="full"
    >
      <IndexTable
        lang={lang}
        rows={inventory.data?.items ?? []}
        getRowId={(row) => row.variant_id}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.stock}
        onViewChange={(key) => {
          const stock = STOCK_FILTERS.find((candidate) => candidate === key);
          if (stock) setFilters({ stock });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        filter_controls={
          can_filter_category ? (
            <NativeSelect
              aria-label={catalog.products.category_filter}
              value={filters.category}
              onChange={(event) => setFilters({ category: event.target.value })}
              className="h-8"
            >
              <NativeSelectOption value="">{catalog.products.all_categories}</NativeSelectOption>
              {(categories.data ?? []).map((category) => (
                <NativeSelectOption key={category.id} value={category.id}>
                  {localized(category.name, locale)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : undefined
        }
        page={inventory.data?.page ?? filters.page}
        total_pages={inventory.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={inventory.data ? formatPlural(inventory.data.total_items, dictionary.results, lang) : undefined}
        is_loading={inventory.isFetching}
        empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>}
        renderMobileRow={renderMobileRow}
        dictionary={index_table}
      />

      {inventory.isError && <p className="text-destructive text-sm">{errorText(errors, inventory.error)}</p>}

      <StockDialog
        row={open_row}
        onOpenChange={(is_open) => !is_open && setOpenRow(null)}
        title={open_row ? title(open_row) : ""}
        lang={lang}
        can_edit={can_edit}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
    </Page>
  );
}

// Typing a new number and pressing Enter (or leaving the field) sets the stock, logged as a correction.
function StockInput({
  row,
  label,
  title,
  dictionary,
  errors,
}: {
  row: InventoryRow;
  label: string;
  title: string;
  dictionary: AdminDictionary["inventory"];
  errors: AdminDictionary["errors"];
}) {
  const adjust = useAdjustStock();
  const [value, setValue] = useState(String(row.stock));

  function save() {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK) {
      setValue(String(row.stock));
      toast.error(errors.invalid_input);
      return;
    }
    if (quantity === row.stock) return;
    adjust.mutate(
      { variant_id: row.variant_id, mode: "set", quantity, reason: "correction", note: "" },
      {
        onSuccess: () => toast.success(dictionary.saved),
        onError: (error) => {
          setValue(String(row.stock));
          toast.error(errorText(errors, error));
        },
      },
    );
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_STOCK}
      value={value}
      disabled={adjust.isPending}
      aria-label={label.replace("{name}", title)}
      className="ml-auto h-8 w-24 text-right tabular-nums"
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setValue(String(row.stock));
      }}
    />
  );
}
