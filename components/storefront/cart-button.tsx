"use client";

import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { selectCartCount, useCartStore } from "@/store/cart-store";

type CartButtonProps = {
  lang: string;
  label: string;
  // "Cart, {count} items"
  count_label: string;
};

export function CartButton({ lang, label, count_label }: CartButtonProps) {
  const count = useCartStore(selectCartCount);

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href={`/${lang}/cart`} aria-label={count > 0 ? count_label.replace("{count}", String(count)) : label}>
        <ShoppingBagIcon />
        {count > 0 && (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] leading-4.5 font-semibold tabular-nums"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
