"use client";

import type { ReactNode } from "react";

import type { StoreProductCard } from "@repo/core/actions/storefront";
import { useWishlist } from "@repo/core/hooks/use-wishlist";
import type { Dictionary } from "@repo/core/lib/i18n";
import { ProductCard } from "@/components/storefront/product-card";

type WishlistGridProps = {
  lang: string;
  currency: string;
  products: StoreProductCard[];
  dictionary: Dictionary["store"]["card"];
  empty: ReactNode;
};

// The saved products; one removed with its heart disappears right away.
export function WishlistGrid({ lang, currency, products, dictionary, empty }: WishlistGridProps) {
  const wishlist = useWishlist();
  const visible = wishlist.is_signed_in ? products.filter((product) => wishlist.has(product.id)) : products;
  if (visible.length === 0) return empty;

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {visible.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} lang={lang} currency={currency} dictionary={dictionary} />
        </li>
      ))}
    </ul>
  );
}
