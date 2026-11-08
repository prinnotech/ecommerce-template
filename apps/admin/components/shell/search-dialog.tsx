"use client";

import { ReceiptIcon, SearchIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type KeyboardEvent } from "react";

import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/components/ui/dialog";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useAdminSearch } from "@repo/core/hooks/use-admin";
import { isLocale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { formatCurrency } from "@repo/core/lib/utils/format";

type Result = {
  key: string;
  href: string;
  group: "orders" | "products" | "customers";
  title: string;
  detail: string;
  image?: string;
};

type SearchDialogProps = {
  lang: string;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: AdminDictionary["admin_shell"];
  errors: AdminDictionary["errors"];
  close_label: string;
};

// The query only follows the text after a short pause, so typing doesn't fire a search per key.
function useDebounced(value: string, delay_ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay_ms);
    return () => window.clearTimeout(timer);
  }, [value, delay_ms]);
  return debounced;
}

// Global search over orders, products and customers (top bar, Ctrl/⌘ K). Arrow keys move through
// the results, Enter opens one.
export function SearchDialog({ lang, is_open, onOpenChange, dictionary, errors, close_label }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active_index, setActiveIndex] = useState(0);
  const debounced = useDebounced(query, 250);
  const search = useAdminSearch(debounced);
  const locale = isLocale(lang) ? lang : "en";

  const results: Result[] = search.data
    ? [
        ...search.data.orders.map((order) => ({
          key: `order-${order.id}`,
          href: `/orders/${order.id}`,
          group: "orders" as const,
          title: dictionary.order_label.replace("{number}", String(order.order_number)),
          detail: [order.customer_name || order.email, formatCurrency(order.total, order.currency, lang)].join(" · "),
        })),
        ...search.data.products.map((product) => ({
          key: `product-${product.id}`,
          href: `/products/${product.id}`,
          group: "products" as const,
          title: localized(product.title, locale),
          detail: "",
          image: product.image_url,
        })),
        ...search.data.customers.map((customer) => ({
          key: `customer-${customer.key}`,
          href: `/customers/${customer.key}`,
          group: "customers" as const,
          title: customer.name || customer.email,
          detail: customer.name ? customer.email : "",
        })),
      ]
    : [];
  const is_ready = debounced.trim().length >= 2;
  const selected_index = Math.min(active_index, Math.max(results.length - 1, 0));

  function open(result: Result) {
    onOpenChange(false);
    setQuery("");
    router.push(result.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((selected_index + step + results.length) % results.length);
    } else if (event.key === "Enter" && results[selected_index]) {
      event.preventDefault();
      open(results[selected_index]);
    }
  }

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={close_label}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{dictionary.search_dialog_title}</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="admin-search-results"
            aria-activedescendant={results[selected_index] ? `search-${results[selected_index].key}` : undefined}
            aria-label={dictionary.search_input_label}
            placeholder={dictionary.search_input_label}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            className="placeholder:text-muted-foreground h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {search.isFetching && <Spinner aria-label={dictionary.searching} />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2" aria-live="polite">
          {!is_ready && <p className="text-muted-foreground px-2 py-6 text-center text-sm">{dictionary.search_hint}</p>}
          {is_ready && search.isError && (
            <p className="text-destructive px-2 py-6 text-center text-sm">{errorText(errors, search.error)}</p>
          )}
          {is_ready && search.isSuccess && results.length === 0 && (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              {dictionary.no_results.replace("{query}", debounced.trim())}
            </p>
          )}
          {results.length > 0 && (
            <ul id="admin-search-results" role="listbox" aria-label={dictionary.search_dialog_title}>
              {results.map((result, index) => (
                <li key={result.key} role="presentation">
                  {(index === 0 || results[index - 1]?.group !== result.group) && (
                    <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">
                      {dictionary.groups[result.group]}
                    </p>
                  )}
                  <button
                    id={`search-${result.key}`}
                    type="button"
                    role="option"
                    aria-selected={index === selected_index}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => open(result)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                      index === selected_index && "bg-muted",
                    )}
                  >
                    {result.group === "products" ? (
                      <Thumbnail src={result.image} alt="" size="sm" />
                    ) : (
                      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md border">
                        {result.group === "orders" ? (
                          <ReceiptIcon className="size-4" />
                        ) : (
                          <UserIcon className="size-4" />
                        )}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{result.title}</span>
                      {result.detail && <span className="text-muted-foreground truncate text-xs">{result.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
