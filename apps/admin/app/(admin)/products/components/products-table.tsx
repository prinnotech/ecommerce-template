"use client";

import { PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { IndexTable, type BulkAction, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { AdminProductRow } from "@repo/core/actions/products";
import {
  useAdminCategories,
  useAdminProducts,
  useBulkDeleteProducts,
  useBulkSetProductCategory,
  useBulkSetProductStatus,
} from "@repo/core/hooks/use-catalog";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import {
  product_list_filters_schema,
  type ProductListFilters,
  type ProductStatus,
} from "@repo/core/lib/schemas/catalog";
import { formatCurrency, formatDate, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";

const STATUS_TONE: Record<ProductStatus, StatusTone> = {
  active: "success",
  draft: "info",
  archived: "neutral",
};

// Shopify's default product views, mapped onto the status filter.
const VIEWS = [
  { key: "all", status: "all" },
  { key: "active", status: "active" },
  { key: "draft", status: "draft" },
  { key: "archived", status: "archived" },
] as const;

type ProductsTableProps = {
  lang: string;
  currency: string;
  can_edit: boolean;
  dictionary: AdminDictionary["catalog"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  errors: AdminDictionary["errors"];
};

export function ProductsTable({
  lang,
  currency,
  can_edit,
  dictionary,
  index_table,
  confirm,
  errors,
}: ProductsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = product_list_filters_schema.parse(Object.fromEntries(search_params));
  const products = useAdminProducts(filters);
  const categories = useAdminCategories();
  const set_status = useBulkSetProductStatus();
  const set_category = useBulkSetProductCategory();
  const delete_products = useBulkDeleteProducts();
  const text = dictionary.products;
  const locale = lang as Locale;

  const [pending_ids, setPendingIds] = useState<string[]>([]);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const [is_move_open, setIsMoveOpen] = useState(false);
  const [move_category, setMoveCategory] = useState("");

  const category_names = new Map(
    (categories.data ?? []).map((category) => [category.id, localized(category.name, locale)]),
  );

  // Any filter change goes back to page 1; empty values are dropped from the URL.
  function setFilters(patch: Partial<ProductListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.category) params.set("category", next.category);
    if (next.sort !== "updated_at") params.set("sort", next.sort);
    if (next.direction !== "desc") params.set("direction", next.direction);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = VIEWS.map((view) => ({
    key: view.key,
    label: view.status === "all" ? text.all : dictionary.status[view.status],
  }));
  const active_view = VIEWS.find((view) => view.status === filters.status)?.key;

  const columns: IndexColumn<AdminProductRow>[] = [
    {
      key: "product",
      header: text.columns.product,
      is_primary: true,
      cell: (product) => (
        <span className="flex items-center gap-3">
          <Thumbnail src={product.image_url} alt="" size="md" />
          <span className="truncate">{localized(product.title, locale) || text.untitled}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: text.columns.status,
      min_width: "sm",
      cell: (product) => (
        <StatusBadge tone={STATUS_TONE[product.status]}>{dictionary.status[product.status]}</StatusBadge>
      ),
    },
    {
      key: "inventory",
      header: text.columns.inventory,
      min_width: "md",
      cell: (product) =>
        product.variant_count === 0
          ? text.no_variants
          : text.inventory_value
              .replace("{stock}", String(product.total_stock))
              .replace("{variants}", String(product.variant_count)),
    },
    {
      key: "category",
      header: text.columns.category,
      min_width: "lg",
      cell: (product) => category_names.get(product.category_id) ?? "—",
    },
    {
      key: "price",
      header: text.columns.price,
      align: "end",
      cell: (product) => formatCurrency(product.price, currency, lang),
    },
    {
      key: "updated",
      header: text.columns.updated,
      align: "end",
      min_width: "md",
      cell: (product) => formatDate(product.updated_at, lang),
    },
  ];

  const sort_options = [
    { key: "updated_at", label: text.columns.updated },
    { key: "price", label: text.columns.price },
  ];

  const bulk_actions: BulkAction[] = can_edit
    ? [
        { key: "publish", label: text.bulk_publish, onSelect: (ids) => handleStatus(ids, "active") },
        { key: "archive", label: text.bulk_archive, onSelect: (ids) => handleStatus(ids, "archived") },
        {
          key: "move",
          label: text.bulk_move,
          onSelect: (ids) => {
            setPendingIds(ids);
            setMoveCategory("");
            setIsMoveOpen(true);
          },
        },
        {
          key: "delete",
          label: text.bulk_delete,
          is_destructive: true,
          onSelect: (ids) => {
            setPendingIds(ids);
            setIsDeleteOpen(true);
          },
        },
      ]
    : [];

  function handleStatus(ids: string[], status: ProductStatus) {
    set_status.mutate(
      { ids, status },
      {
        onSuccess: (result) => toast.success(formatPlural(result.count, text.bulk_updated, lang)),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function confirmDelete() {
    delete_products.mutate(
      { ids: pending_ids },
      {
        onSuccess: (result) => {
          setIsDeleteOpen(false);
          toast.success(formatPlural(result.count, text.bulk_updated, lang));
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function confirmMove() {
    set_category.mutate(
      { ids: pending_ids, category: move_category },
      {
        onSuccess: (result) => {
          setIsMoveOpen(false);
          toast.success(formatPlural(result.count, text.bulk_updated, lang));
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function renderMobileRow(product: AdminProductRow) {
    return (
      <div className="flex items-center gap-3">
        <Thumbnail src={product.image_url} alt="" size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium">{localized(product.title, locale) || text.untitled}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={STATUS_TONE[product.status]}>{dictionary.status[product.status]}</StatusBadge>
            <span className="text-muted-foreground text-xs">{formatCurrency(product.price, currency, lang)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Page
      title={text.title}
      width="full"
      secondary_actions={
        can_edit ? (
          <Button asChild variant="outline">
            <Link href="/products/import">
              <UploadIcon />
              {text.import}
            </Link>
          </Button>
        ) : undefined
      }
      primary_action={
        can_edit ? (
          <Button asChild>
            <Link href="/products/new">
              <PlusIcon />
              {text.add}
            </Link>
          </Button>
        ) : undefined
      }
    >
      <IndexTable
        lang={lang}
        rows={products.data?.items ?? []}
        getRowId={(product) => product.id}
        getRowHref={(product) => `/products/${product.id}`}
        columns={columns}
        resource_label={text.title}
        views={views}
        active_view={active_view}
        onViewChange={(key) => {
          const view = VIEWS.find((candidate) => candidate.key === key);
          if (view) setFilters({ status: view.status });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={text.search_placeholder}
        filter_controls={
          <NativeSelect
            aria-label={text.category_filter}
            value={filters.category}
            onChange={(event) => setFilters({ category: event.target.value })}
            className="h-8"
          >
            <NativeSelectOption value="">{text.all_categories}</NativeSelectOption>
            {(categories.data ?? []).map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {localized(category.name, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
        sort_options={sort_options}
        sort={{ key: filters.sort, direction: filters.direction }}
        onSortChange={(sort) => setFilters({ sort: sort.key as ProductListFilters["sort"], direction: sort.direction })}
        bulk_actions={bulk_actions}
        page={products.data?.page ?? filters.page}
        total_pages={products.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={products.data ? formatPlural(products.data.total_items, text.results, lang) : undefined}
        is_loading={products.isFetching}
        empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{text.empty}</p>}
        renderMobileRow={renderMobileRow}
        dictionary={index_table}
      />

      {products.isError && <p className="text-destructive text-sm">{errorText(errors, products.error)}</p>}

      <ConfirmDialog
        is_open={is_delete_open}
        onOpenChange={setIsDeleteOpen}
        title={text.bulk_delete_title}
        body={text.bulk_delete_body}
        confirm_label={text.bulk_delete}
        cancel_label={confirm.cancel}
        onConfirm={confirmDelete}
        is_pending={delete_products.isPending}
        is_destructive
      />

      <Dialog open={is_move_open} onOpenChange={setIsMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{text.move_title}</DialogTitle>
            <DialogDescription>{text.move_hint}</DialogDescription>
          </DialogHeader>
          <NativeSelect
            aria-label={text.category_filter}
            value={move_category}
            onChange={(event) => setMoveCategory(event.target.value)}
          >
            <NativeSelectOption value="">{text.no_category}</NativeSelectOption>
            {(categories.data ?? []).map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {localized(category.name, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMoveOpen(false)}
              disabled={set_category.isPending}
            >
              {confirm.cancel}
            </Button>
            <Button type="button" onClick={confirmMove} disabled={set_category.isPending}>
              {text.bulk_move}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
