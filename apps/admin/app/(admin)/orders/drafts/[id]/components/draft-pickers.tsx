"use client";

import { PlusIcon, SearchIcon, UserIcon } from "lucide-react";
import { useState } from "react";

import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { DraftCustomer } from "@repo/core/actions/draft-orders";
import type { InventoryRow } from "@repo/core/backend/types";
import { useDraftCustomerSearch, useDraftVariantSearch } from "@repo/core/hooks/use-draft-orders";
import type { Locale } from "@repo/core/i18nConfig";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";

type Text = AdminDictionary["draft_orders"];

export function variantText(row: Pick<InventoryRow, "size" | "color" | "sku">): string {
  return [[row.size, row.color].filter(Boolean).join(" / "), row.sku].filter(Boolean).join(" · ");
}

// Search the catalog and add a variant (results open below the field, in the card, while typing).
export function ProductPicker({
  lang,
  disabled,
  onPick,
  dictionary,
}: {
  lang: string;
  disabled: boolean;
  onPick: (row: InventoryRow) => void;
  dictionary: Text;
}) {
  const [search, setSearch] = useState("");
  const [is_open, setIsOpen] = useState(false);
  const results = useDraftVariantSearch(is_open ? search : "");

  return (
    <div>
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={search}
          disabled={disabled}
          placeholder={dictionary.search_products}
          aria-label={dictionary.search_products}
          className="pl-9"
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {is_open && (
        <ul className="bg-popover mt-1 max-h-80 overflow-y-auto rounded-md border p-1 shadow-md">
          {(results.data ?? []).length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">
              {results.isFetching ? "…" : dictionary.no_products}
            </li>
          ) : (
            results.data?.map((row) => (
              <li key={row.variant_id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPick(row);
                    setSearch("");
                    setIsOpen(false);
                  }}
                >
                  <Thumbnail src={row.image_url} alt="" size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{localized(row.product_title, lang as Locale)}</span>
                    <span className="text-muted-foreground truncate text-xs">{variantText(row)}</span>
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {dictionary.in_stock.replace("{stock}", String(row.stock))}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function CustomItemDialog({
  is_open,
  onOpenChange,
  onAdd,
  currency,
  lang,
  dictionary,
  common,
}: {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  onAdd: (line: { title: string; unit_price: number; quantity: number }) => void;
  currency: string;
  lang: string;
  dictionary: Text;
  common: AdminDictionary["common"];
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const is_valid = title.trim().length > 0 && Number.isFinite(price) && price >= 0 && quantity >= 1;

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dictionary.custom_item}</DialogTitle>
          <DialogDescription>{dictionary.custom_item_hint}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="custom-title">{dictionary.item_name}</FieldLabel>
          <Input id="custom-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="custom-price">{dictionary.price}</FieldLabel>
            <MoneyInput id="custom-price" cents={price} onChange={setPrice} currency={currency} lang={lang} />
          </Field>
          <Field>
            <FieldLabel htmlFor="custom-quantity">{dictionary.quantity}</FieldLabel>
            <Input
              id="custom-quantity"
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(999, Math.round(Number(event.target.value)) || 1)))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {common.cancel}
          </Button>
          <Button
            type="button"
            disabled={!is_valid}
            onClick={() => {
              onAdd({ title: title.trim(), unit_price: price, quantity });
              setTitle("");
              setPrice(0);
              setQuantity(1);
              onOpenChange(false);
            }}
          >
            <PlusIcon />
            {dictionary.add_item}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Find a customer account by name or email; picking one fills the contact fields.
export function CustomerPicker({
  disabled,
  onPick,
  dictionary,
}: {
  disabled: boolean;
  onPick: (customer: DraftCustomer) => void;
  dictionary: Text;
}) {
  const [search, setSearch] = useState("");
  const [is_open, setIsOpen] = useState(false);
  const results = useDraftCustomerSearch(search);

  return (
    <div>
      <div className="relative">
        <UserIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={search}
          disabled={disabled}
          placeholder={dictionary.search_customers}
          aria-label={dictionary.search_customers}
          className="pl-9"
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {is_open && search.trim().length >= 2 && (
        <ul className="bg-popover mt-1 max-h-72 overflow-y-auto rounded-md border p-1 shadow-md">
          {(results.data ?? []).length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">
              {results.isFetching ? "…" : dictionary.no_customers}
            </li>
          ) : (
            results.data?.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPick(customer);
                    setSearch("");
                    setIsOpen(false);
                  }}
                >
                  <span>{customer.name || customer.email}</span>
                  {customer.name && <span className="text-muted-foreground text-xs">{customer.email}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
