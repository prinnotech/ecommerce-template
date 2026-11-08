"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";

import { ShopFilters } from "./shop-filters";
import { Button } from "@repo/ui/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { SHOP_SORTS, shopQuery, type ShopSort } from "@repo/core/lib/schemas/storefront";

type ShopToolbarProps = ComponentProps<typeof ShopFilters> & {
  results_label: string;
  active_filter_count: number;
  close_label: string;
};

// Result count, sort and (on mobile) the filters sheet.
export function ShopToolbar({ results_label, active_filter_count, close_label, ...filter_props }: ShopToolbarProps) {
  const router = useRouter();
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const { lang, filters, dictionary } = filter_props;

  return (
    <div className="flex items-center justify-between gap-3 border-b pb-4">
      <div className="flex items-center gap-3">
        <Sheet open={is_sheet_open} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden">
              <SlidersHorizontalIcon />
              {dictionary.filters}
              {active_filter_count > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums">
                  {active_filter_count}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" closeLabel={close_label} className="w-[88vw] max-w-sm gap-0">
            <SheetHeader className="border-b">
              <SheetTitle>{dictionary.filters_title}</SheetTitle>
              <SheetDescription className="sr-only">{dictionary.filters_title}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <ShopFilters {...filter_props} onApplied={() => setIsSheetOpen(false)} />
            </div>
            <SheetFooter className="border-t">
              <Button onClick={() => setIsSheetOpen(false)}>{dictionary.show_results}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <span className="text-muted-foreground text-sm">{results_label}</span>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="shop-sort" className="text-muted-foreground hidden text-sm sm:inline">
          {dictionary.sort}
        </label>
        <NativeSelect
          id="shop-sort"
          size="sm"
          aria-label={dictionary.sort}
          value={filters.sort}
          onChange={(event) =>
            router.push(`/${lang}/shop${shopQuery({ ...filters, sort: event.target.value as ShopSort, page: 1 })}`, {
              scroll: false,
            })
          }
        >
          {SHOP_SORTS.map((sort) => (
            <NativeSelectOption key={sort} value={sort}>
              {dictionary.sort_options[sort]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
