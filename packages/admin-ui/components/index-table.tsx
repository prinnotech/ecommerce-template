"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { formatPlural } from "@repo/core/lib/utils/format";
import { EmptyState } from "@repo/admin-ui/components/empty-state";

export type IndexColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  align?: "start" | "end";
  // Hidden below this breakpoint so the table never scrolls sideways (audit P3).
  min_width?: "sm" | "md" | "lg" | "xl";
  // The column holding the row's name; it carries the row link.
  is_primary?: boolean;
  className?: string;
};

export type IndexView = { key: string; label: string };
export type ActiveFilter = { key: string; label: string };
export type SortOption = { key: string; label: string };
export type SortDirection = "asc" | "desc";

export type BulkAction = {
  key: string;
  label: string;
  is_destructive?: boolean;
  onSelect: (ids: string[]) => void;
};

const HIDDEN_BELOW = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

type IndexTableProps<Row> = {
  lang: string;
  rows: Row[];
  getRowId: (row: Row) => string;
  getRowHref?: (row: Row) => string;
  // For rows that open something on the same page (the message reader) instead of a link.
  onRowClick?: (row: Row) => void;
  columns: IndexColumn<Row>[];
  // What the list holds ("orders"), for the search field's label.
  resource_label: string;

  views?: IndexView[];
  active_view?: string;
  onViewChange?: (view: string) => void;

  search?: string;
  onSearchChange?: (search: string) => void;
  search_placeholder?: string;
  // Filter buttons (popovers) shown next to the search.
  filter_controls?: React.ReactNode;
  active_filters?: ActiveFilter[];
  onRemoveFilter?: (key: string) => void;
  onClearFilters?: () => void;

  sort_options?: SortOption[];
  sort?: { key: string; direction: SortDirection };
  onSortChange?: (sort: { key: string; direction: SortDirection }) => void;

  bulk_actions?: BulkAction[];

  page?: number;
  total_pages?: number;
  onPageChange?: (page: number) => void;
  // "42 orders", shown next to the pagination.
  summary?: string;

  // A refetch is running: the rows dim instead of disappearing.
  is_loading?: boolean;
  // Shown when the list is empty without any filter (first-use state with a call to action).
  empty_state?: React.ReactNode;
  // Phones: one stacked block per row (name, then status badges) instead of table columns (audit O1).
  renderMobileRow?: (row: Row) => React.ReactNode;
  dictionary: AdminDictionary["admin_ui"]["index_table"];
};

// Shopify's index table: view tabs, search + filter chips, sort, row selection with a bulk-action
// bar, pagination. The caller owns the data and the URL state (useUrlState); selection is local.
export function IndexTable<Row>(props: IndexTableProps<Row>) {
  const {
    lang,
    rows,
    getRowId,
    getRowHref,
    onRowClick,
    columns,
    views,
    active_view,
    onViewChange,
    active_filters = [],
    bulk_actions = [],
    page = 1,
    total_pages = 1,
    onPageChange,
    summary,
    is_loading,
    empty_state,
    renderMobileRow,
    dictionary,
  } = props;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible_ids = rows.map(getRowId);
  // Selection only covers rows on screen: after a page or filter change, hidden rows drop out.
  const selected_ids = visible_ids.filter((id) => selected.has(id));
  const is_selectable = bulk_actions.length > 0;
  const all_state = selected_ids.length === 0 ? false : selected_ids.length === rows.length ? true : "indeterminate";
  const has_filters = Boolean(props.search) || active_filters.length > 0;

  function toggleRow(id: string, is_checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (is_checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(is_checked: boolean) {
    setSelected(is_checked ? new Set(visible_ids) : new Set());
  }

  if (rows.length === 0 && !has_filters && !is_loading && empty_state) {
    return <div className="bg-card ring-foreground/10 rounded-xl ring-1">{empty_state}</div>;
  }

  return (
    <div className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl text-sm ring-1">
      {views && views.length > 0 && (
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b px-2 pt-2">
          {views.map((view) => {
            const is_active = view.key === active_view;
            return (
              <button
                key={view.key}
                type="button"
                role="tab"
                aria-selected={is_active}
                onClick={() => onViewChange?.(view.key)}
                className={cn(
                  "focus-visible:ring-ring/50 mb-2 shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-3",
                  is_active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      )}

      <Toolbar {...props} />

      {active_filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          {active_filters.map((filter) => (
            <span
              key={filter.key}
              className="bg-muted inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-3 text-xs"
            >
              {filter.label}
              <button
                type="button"
                onClick={() => props.onRemoveFilter?.(filter.key)}
                aria-label={dictionary.remove_filter.replace("{name}", filter.label)}
                className="hover:bg-background focus-visible:ring-ring/50 inline-flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-3"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          {props.onClearFilters && (
            <Button type="button" variant="link" size="xs" onClick={props.onClearFilters}>
              {dictionary.clear_filters}
            </Button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={SearchIcon} title={dictionary.no_results_title} body={dictionary.no_results_body} />
      ) : (
        <div
          className={cn("transition-opacity", is_loading && "pointer-events-none opacity-50")}
          aria-busy={is_loading}
        >
          {renderMobileRow && (
            <ul className="divide-y md:hidden">
              {rows.map((row) => {
                const id = getRowId(row);
                const href = getRowHref?.(row);
                return (
                  <li key={id} className="relative flex items-start gap-3 px-3 py-3">
                    {is_selectable && (
                      <Checkbox
                        className="relative z-10 mt-0.5"
                        checked={selected.has(id)}
                        onCheckedChange={(checked) => toggleRow(id, checked === true)}
                        aria-label={dictionary.select_row}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {href ? (
                        <Link
                          href={href}
                          className="block outline-none after:absolute after:inset-0 focus-visible:underline"
                        >
                          {renderMobileRow(row)}
                        </Link>
                      ) : onRowClick ? (
                        <button
                          type="button"
                          onClick={() => onRowClick(row)}
                          className="block w-full text-left outline-none after:absolute after:inset-0 focus-visible:underline"
                        >
                          {renderMobileRow(row)}
                        </button>
                      ) : (
                        renderMobileRow(row)
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={cn("relative", renderMobileRow && "hidden md:block")}>
            {selected_ids.length > 0 && (
              <div className="bg-muted absolute inset-x-0 top-0 left-10 z-20 flex min-h-9 items-center border-b px-3 py-1">
                <BulkBar
                  lang={lang}
                  selected_ids={selected_ids}
                  bulk_actions={bulk_actions}
                  onDeselect={() => setSelected(new Set())}
                  dictionary={dictionary}
                />
              </div>
            )}
            <table className="w-full caption-bottom text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b">
                  {is_selectable && (
                    <th scope="col" className="w-10 px-3 py-2">
                      <Checkbox
                        checked={all_state}
                        onCheckedChange={(checked) => toggleAll(checked === true)}
                        aria-label={dictionary.select_all}
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "text-muted-foreground h-9 px-3 text-xs font-medium whitespace-nowrap",
                        column.align === "end" ? "text-right" : "text-left",
                        column.min_width && HIDDEN_BELOW[column.min_width],
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = getRowId(row);
                  const href = getRowHref?.(row);
                  const is_selected = selected.has(id);
                  return (
                    <tr
                      key={id}
                      data-state={is_selected ? "selected" : undefined}
                      className="hover:bg-muted/40 data-[state=selected]:bg-muted relative border-b transition-colors last:border-b-0"
                    >
                      {is_selectable && (
                        <td className="relative z-10 w-10 px-3 py-2.5">
                          <Checkbox
                            checked={is_selected}
                            onCheckedChange={(checked) => toggleRow(id, checked === true)}
                            aria-label={dictionary.select_row}
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            "px-3 py-2.5 align-middle",
                            column.align === "end" && "text-right tabular-nums",
                            column.min_width && HIDDEN_BELOW[column.min_width],
                            column.className,
                          )}
                        >
                          {column.is_primary && href ? (
                            // The link covers the whole row; the checkbox sits above it (z-10).
                            <Link
                              href={href}
                              className="font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                            >
                              {column.cell(row)}
                            </Link>
                          ) : column.is_primary && onRowClick ? (
                            // Same as the link: the button covers the whole row.
                            <button
                              type="button"
                              onClick={() => onRowClick(row)}
                              className="text-left font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                            >
                              {column.cell(row)}
                            </button>
                          ) : (
                            column.cell(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: the bulk bar can't live in the hidden table header. */}
          {renderMobileRow && selected_ids.length > 0 && (
            <div className="bg-background sticky bottom-0 border-t px-3 py-2 md:hidden">
              <BulkBar
                lang={lang}
                selected_ids={selected_ids}
                bulk_actions={bulk_actions}
                onDeselect={() => setSelected(new Set())}
                dictionary={dictionary}
              />
            </div>
          )}
        </div>
      )}

      {(summary || total_pages > 1) && (
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <p className="text-muted-foreground text-xs">{summary}</p>
          {total_pages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {dictionary.page_of.replace("{page}", String(page)).replace("{total}", String(total_pages))}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
                aria-label={dictionary.previous}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page >= total_pages}
                onClick={() => onPageChange?.(page + 1)}
                aria-label={dictionary.next}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar<Row>({
  search,
  onSearchChange,
  search_placeholder,
  resource_label,
  filter_controls,
  sort_options,
  sort,
  onSortChange,
  dictionary,
}: IndexTableProps<Row>) {
  if (!onSearchChange && !filter_controls && !sort_options) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-2">
      {onSearchChange && (
        <SearchField
          value={search ?? ""}
          onChange={onSearchChange}
          placeholder={search_placeholder ?? dictionary.search}
          label={dictionary.search_label.replace("{resource}", resource_label)}
        />
      )}
      {filter_controls}
      {sort_options && sort && onSortChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="ml-auto">
              <ArrowUpDownIcon />
              <span className="sr-only sm:not-sr-only">{dictionary.sort}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{dictionary.sort}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort.key}
              onValueChange={(key) => onSortChange({ key, direction: sort.direction })}
            >
              {sort_options.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sort.direction}
              onValueChange={(direction) => onSortChange({ key: sort.key, direction: direction as SortDirection })}
            >
              <DropdownMenuRadioItem value="asc">
                <ArrowUpIcon />
                {dictionary.sort_ascending}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                <ArrowDownIcon />
                {dictionary.sort_descending}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// Typing updates the field at once; the URL (and so the query) follows after a short pause.
function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className="relative min-w-0 flex-1 basis-48">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 pl-8"
      />
    </div>
  );
}

function BulkBar({
  lang,
  selected_ids,
  bulk_actions,
  onDeselect,
  dictionary,
}: {
  lang: string;
  selected_ids: string[];
  bulk_actions: BulkAction[];
  onDeselect: () => void;
  dictionary: AdminDictionary["admin_ui"]["index_table"];
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="text-sm font-medium" aria-live="polite">
        {formatPlural(selected_ids.length, dictionary.selected, lang)}
      </span>
      <Button type="button" variant="ghost" size="xs" onClick={onDeselect}>
        {dictionary.deselect}
      </Button>
      <div className="ml-auto flex flex-wrap gap-2">
        {bulk_actions.map((action) => (
          <Button
            key={action.key}
            type="button"
            size="sm"
            variant={action.is_destructive ? "destructive" : "outline"}
            onClick={() => action.onSelect(selected_ids)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
