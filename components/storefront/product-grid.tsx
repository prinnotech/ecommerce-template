import type { StoreProductCard } from "@/app/actions/storefront";
import { ProductCard } from "@/components/storefront/product-card";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ProductGridProps = {
  products: StoreProductCard[];
  lang: string;
  currency: string;
  dictionary: Dictionary["store"]["card"];
  columns?: 3 | 4;
  priority_count?: number;
};

export function ProductGrid({
  products,
  lang,
  currency,
  dictionary,
  columns = 4,
  priority_count = 0,
}: ProductGridProps) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3",
        columns === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            lang={lang}
            currency={currency}
            dictionary={dictionary}
            is_priority={index < priority_count}
          />
        </li>
      ))}
    </ul>
  );
}
