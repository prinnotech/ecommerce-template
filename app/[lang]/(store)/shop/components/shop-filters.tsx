"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

import type { StoreCategory, StoreColor } from "@/app/actions/storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Locale } from "@/i18nConfig";
import type { Dictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { shopQuery, type ShopFilters as Filters } from "@/lib/schemas/storefront";
import { cn } from "@/lib/utils";

type ShopFiltersProps = {
  lang: string;
  filters: Filters;
  categories: StoreCategory[];
  sizes: string[];
  colors: StoreColor[];
  currency: string;
  dictionary: Dictionary["store"]["shop"];
  // Called after a filter changes (the mobile sheet closes itself).
  onApplied?: () => void;
};

export function ShopFilters({
  lang,
  filters,
  categories,
  sizes,
  colors,
  currency,
  dictionary,
  onApplied,
}: ShopFiltersProps) {
  const router = useRouter();
  const [is_pending, startTransition] = useTransition();
  const locale = lang as Locale;
  const base = `/${lang}/shop`;

  // Any change returns to page 1.
  function apply(patch: Partial<Filters>) {
    startTransition(() => router.push(`${base}${shopQuery({ ...filters, page: 1, ...patch })}`, { scroll: false }));
    onApplied?.();
  }

  function onPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const toUnits = (name: string) => Math.max(0, Math.floor(Number(form_data.get(name)) || 0));
    apply({ min: toUnits("min"), max: toUnits("max") });
  }

  const parents = categories.filter((category) => !category.parent);

  return (
    <div className={cn("flex flex-col gap-8 transition-opacity", is_pending && "opacity-60")} aria-busy={is_pending}>
      <FilterGroup title={dictionary.category}>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <CategoryLink
              href={`${base}${shopQuery({ ...filters, category: "", page: 1 })}`}
              label={dictionary.all_categories}
              is_active={!filters.category}
              onClick={onApplied}
            />
          </li>
          {parents.map((parent) => (
            <li key={parent.id}>
              <CategoryLink
                href={`${base}${shopQuery({ ...filters, category: parent.slug, page: 1 })}`}
                label={localized(parent.name, locale)}
                is_active={filters.category === parent.slug}
                onClick={onApplied}
              />
              {categories
                .filter((child) => child.parent === parent.id)
                .map((child) => (
                  <CategoryLink
                    key={child.id}
                    href={`${base}${shopQuery({ ...filters, category: child.slug, page: 1 })}`}
                    label={localized(child.name, locale)}
                    is_active={filters.category === child.slug}
                    onClick={onApplied}
                    is_child
                  />
                ))}
            </li>
          ))}
        </ul>
      </FilterGroup>

      {sizes.length > 0 && (
        <FilterGroup title={dictionary.size}>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const is_active = filters.size === size;
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={is_active}
                  onClick={() => apply({ size: is_active ? "" : size })}
                  className={cn(
                    "min-w-11 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    is_active ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground",
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {colors.length > 0 && (
        <FilterGroup title={dictionary.color}>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((color) => {
              const is_active = filters.color.toLowerCase() === color.name.toLowerCase();
              return (
                <button
                  key={color.name}
                  type="button"
                  aria-pressed={is_active}
                  aria-label={color.name}
                  title={color.name}
                  onClick={() => apply({ color: is_active ? "" : color.name })}
                  className={cn(
                    "ring-border flex size-8 items-center justify-center rounded-full ring-1 ring-offset-2 transition",
                    is_active ? "ring-foreground ring-2" : "hover:ring-foreground/60",
                  )}
                  style={{ backgroundColor: color.hex || undefined }}
                >
                  {is_active && <CheckIcon className="text-background size-4 mix-blend-difference" aria-hidden />}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={`${dictionary.price} (${currency})`}>
        <form onSubmit={onPrice} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="price-min" className="text-muted-foreground text-xs">
              {dictionary.min}
            </Label>
            <Input
              id="price-min"
              name="min"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={filters.min || ""}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="price-max" className="text-muted-foreground text-xs">
              {dictionary.max}
            </Label>
            <Input
              id="price-max"
              name="max"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={filters.max || ""}
            />
          </div>
          <Button type="submit" variant="outline">
            {dictionary.apply_price}
          </Button>
        </form>
      </FilterGroup>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="in-stock" className="text-sm font-medium">
          {dictionary.in_stock}
        </Label>
        <Switch id="in-stock" checked={filters.in_stock} onCheckedChange={(in_stock) => apply({ in_stock })} />
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

function CategoryLink({
  href,
  label,
  is_active,
  is_child,
  onClick,
}: {
  href: string;
  label: string;
  is_active: boolean;
  is_child?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={onClick}
      aria-current={is_active ? "page" : undefined}
      className={cn(
        "block rounded-md py-1 transition-colors",
        is_child && "pl-4",
        is_active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
