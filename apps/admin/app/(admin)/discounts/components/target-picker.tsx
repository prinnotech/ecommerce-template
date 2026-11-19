"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";

import type { DiscountTarget } from "@repo/core/backend/types";
import { FormField } from "@repo/core/components/form-field";
import { useAdminCategories, useAdminProducts } from "@repo/core/hooks/use-catalog";
import type { Locale } from "@repo/core/i18nConfig";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { product_list_filters_schema } from "@repo/core/lib/schemas/catalog";
import type { DiscountAppliesTo } from "@repo/core/lib/schemas/discounts";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";

type TargetPickerProps = {
  id: string;
  label: string;
  lang: string;
  value: DiscountAppliesTo;
  // Names of the picked products and categories (from the server, plus the ones picked here).
  names: Map<string, DiscountTarget>;
  // The label of the "all" choice ("The whole order", "Any product").
  all_label: string;
  error?: string;
  is_locked: boolean;
  onChange: (value: DiscountAppliesTo, picked?: DiscountTarget) => void;
  dictionary: AdminDictionary["discounts"];
};

// "Applies to": everything, some products (searchable) or some categories.
export function TargetPicker({
  id,
  label,
  lang,
  value,
  names,
  all_label,
  error,
  is_locked,
  onChange,
  dictionary,
}: TargetPickerProps) {
  const [search, setSearch] = useState("");
  const products = useAdminProducts(product_list_filters_schema.parse({ search }));
  const categories = useAdminCategories();
  const locale = lang as Locale;

  function toggle(target: DiscountTarget, is_on: boolean) {
    const ids = is_on ? [...new Set([...value.ids, target.id])] : value.ids.filter((item) => item !== target.id);
    onChange({ ...value, ids }, is_on ? target : undefined);
  }

  const picked = value.ids.flatMap((item) => {
    const target = names.get(item);
    return target ? [target] : [];
  });

  return (
    <div className="flex flex-col gap-3">
      <FormField id={id} label={label} error={error}>
        {(control) => (
          <NativeSelect
            {...control}
            value={value.kind}
            disabled={is_locked}
            className="w-full"
            onChange={(event) =>
              onChange({
                kind:
                  event.target.value === "products"
                    ? "products"
                    : event.target.value === "categories"
                      ? "categories"
                      : "all",
                ids: [],
              })
            }
          >
            <NativeSelectOption value="all">{all_label}</NativeSelectOption>
            <NativeSelectOption value="products">{dictionary.applies.products}</NativeSelectOption>
            <NativeSelectOption value="categories">{dictionary.applies.categories}</NativeSelectOption>
          </NativeSelect>
        )}
      </FormField>

      {value.kind === "products" && (
        <div className="flex flex-col gap-2">
          {picked.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {picked.map((target) => (
                <li key={target.id} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                  {localized(target.name, locale)}
                  {!is_locked && (
                    <button
                      type="button"
                      aria-label={dictionary.remove_target.replace("{name}", localized(target.name, locale))}
                      onClick={() => toggle(target, false)}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!is_locked && (
            <>
              <Input
                type="search"
                value={search}
                placeholder={dictionary.search_products}
                aria-label={dictionary.search_products}
                onChange={(event) => setSearch(event.target.value)}
              />
              <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                {(products.data?.items ?? []).map((product) => (
                  <li key={product.id}>
                    <label className="hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                      <Checkbox
                        checked={value.ids.includes(product.id)}
                        onCheckedChange={(checked) => toggle({ id: product.id, name: product.title }, checked === true)}
                      />
                      {localized(product.title, locale)}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {value.kind === "categories" && (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
          {(categories.data ?? []).map((category) => (
            <li key={category.id}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <Checkbox
                  checked={value.ids.includes(category.id)}
                  disabled={is_locked}
                  onCheckedChange={(checked) => toggle({ id: category.id, name: category.name }, checked === true)}
                />
                {localized(category.name, locale)}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
