"use client";

import { ImageIcon, PlusIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminCategories, useAdminProducts } from "@/hooks/use-catalog";
import type { Locale } from "@/i18nConfig";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { PRODUCT_STATUSES, product_list_filters_schema, type ProductStatus } from "@/lib/schemas/catalog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const STATUS_VARIANT: Record<ProductStatus, "secondary" | "outline" | "default"> = {
  active: "secondary",
  draft: "outline",
  archived: "outline",
};

type ProductsTableProps = {
  lang: string;
  currency: string;
  can_edit: boolean;
  dictionary: Dictionary["catalog"];
  errors: Dictionary["errors"];
};

export function ProductsTable({ lang, currency, can_edit, dictionary, errors }: ProductsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = product_list_filters_schema.parse(Object.fromEntries(search_params));
  const products = useAdminProducts(filters);
  const categories = useAdminCategories();
  const text = dictionary.products;
  const locale = lang as Locale;

  const category_names = new Map(
    (categories.data ?? []).map((category) => [category.id, localized(category.name, locale)]),
  );
  const is_filtered = filters.search !== "" || filters.status !== "all" || filters.category !== "";

  // Any filter change goes back to page 1; empty values are dropped from the URL.
  function setFilters(patch: Partial<typeof filters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.category) params.set("category", next.category);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ search: String(new FormData(event.currentTarget).get("search") ?? "").trim() });
  }

  const statuses = ["all", ...PRODUCT_STATUSES] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
        {can_edit && (
          <Button asChild>
            <Link href={`/${lang}/dashboard/products/new`}>
              <PlusIcon />
              {text.add}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label={text.status_filter} className="bg-muted flex w-fit gap-1 rounded-lg p-1">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.status === status}
              onClick={() => setFilters({ status })}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                filters.status === status
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {status === "all" ? text.all : dictionary.status[status]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form onSubmit={onSearch} role="search" className="relative">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              // Remount when the URL search changes (back/forward) so the box shows it.
              key={filters.search}
              name="search"
              type="search"
              aria-label={text.search}
              placeholder={text.search_placeholder}
              defaultValue={filters.search}
              className="w-full pl-8 sm:w-64"
            />
          </form>
          <NativeSelect
            aria-label={text.category_filter}
            value={filters.category}
            onChange={(event) => setFilters({ category: event.target.value })}
          >
            <NativeSelectOption value="">{text.all_categories}</NativeSelectOption>
            {(categories.data ?? []).map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {localized(category.name, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card className={cn("py-0", products.isFetching && !products.isPending && "opacity-70 transition-opacity")}>
        {products.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : products.isError ? (
          <p className="text-destructive p-6 text-sm">{errorText(errors, products.error)}</p>
        ) : products.data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-muted-foreground text-sm">{is_filtered ? text.empty_filtered : text.empty}</p>
            {!is_filtered && can_edit && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/${lang}/dashboard/products/new`}>{text.add}</Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{text.columns.product}</TableHead>
                <TableHead>{text.columns.status}</TableHead>
                <TableHead className="hidden md:table-cell">{text.columns.inventory}</TableHead>
                <TableHead className="hidden lg:table-cell">{text.columns.category}</TableHead>
                <TableHead className="text-right">{text.columns.price}</TableHead>
                <TableHead className="hidden pr-4 text-right sm:table-cell">{text.columns.updated}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.items.map((product) => {
                const href = `/${lang}/dashboard/products/${product.id}`;
                const title = localized(product.title, locale) || text.untitled;
                return (
                  <TableRow key={product.id} className="cursor-pointer" onClick={() => router.push(href)}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt=""
                              width={40}
                              height={40}
                              unoptimized
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="text-muted-foreground size-4" aria-hidden />
                          )}
                        </div>
                        <Link
                          href={href}
                          className="font-medium hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {title}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[product.status]}>{dictionary.status[product.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {product.variant_count === 0
                        ? text.no_variants
                        : text.inventory_value
                            .replace("{stock}", String(product.total_stock))
                            .replace("{variants}", String(product.variant_count))}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                      {category_names.get(product.category_id) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(product.price, currency, lang)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden pr-4 text-right text-sm sm:table-cell">
                      {formatDate(product.updated_at, lang)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {products.data && products.data.total_items > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            {text.results.replace("{count}", String(products.data.total_items))}
          </span>
          {products.data.total_pages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {text.page_of
                  .replace("{page}", String(products.data.page))
                  .replace("{total}", String(products.data.total_pages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
              >
                {text.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= products.data.total_pages}
                onClick={() => setFilters({ page: filters.page + 1 })}
              >
                {text.next}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
