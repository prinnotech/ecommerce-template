"use client";

import { ShoppingBagIcon } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useCartDrawerStore } from "@repo/core/store/cart-drawer-store";
import { selectCartCount, useCartStore } from "@repo/core/store/cart-store";
import { formatPlural, type PluralText } from "@repo/core/lib/utils/format";

type CartButtonProps = {
  lang: string;
  label: string;
  // "Cart, {count} item(s)"
  count_label: PluralText;
};

export function CartButton({ lang, label, count_label }: CartButtonProps) {
  const count = useCartStore(selectCartCount);
  const open = useCartDrawerStore((state) => state.open);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={count > 0 ? formatPlural(count, count_label, lang) : label}
      onClick={open}
    >
      <ShoppingBagIcon />
      {count > 0 && (
        <span
          aria-hidden
          className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] leading-4.5 font-semibold tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
