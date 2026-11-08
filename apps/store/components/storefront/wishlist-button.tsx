"use client";

import { HeartIcon } from "lucide-react";

import { useWishlist } from "@repo/core/hooks/use-wishlist";
import { cn } from "@repo/ui/lib/utils";

type WishlistButtonProps = {
  product_id: string;
  dictionary: { add: string; remove: string };
  // "overlay": the round button on a product card's photo; "inline": next to the product title.
  variant?: "overlay" | "inline";
  className?: string;
};

export function WishlistButton({ product_id, dictionary, variant = "overlay", className }: WishlistButtonProps) {
  const wishlist = useWishlist();
  const is_saved = wishlist.has(product_id);
  const label = is_saved ? dictionary.remove : dictionary.add;

  return (
    <button
      type="button"
      aria-pressed={is_saved}
      aria-label={label}
      title={label}
      onClick={() => wishlist.toggle(product_id)}
      className={cn(
        "focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
        variant === "overlay"
          ? "bg-background/90 text-foreground hover:bg-background relative z-10 size-9 shadow-sm"
          : "hover:bg-muted size-10 border",
        className,
      )}
    >
      <HeartIcon className={cn("size-4", is_saved && "fill-current")} aria-hidden />
    </button>
  );
}
