import type { StoreProductCard } from "@repo/core/actions/storefront";
import { ProductCard } from "@/components/storefront/product-card";
import type { Dictionary } from "@repo/core/lib/i18n";
import type { ThemeSettings } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

type ProductGridProps = {
  products: StoreProductCard[];
  lang: string;
  currency: string;
  dictionary: Dictionary["store"]["card"];
  columns?: 3 | 4;
  priority_count?: number;
  card_style?: ThemeSettings["product_card"];
};

export function ProductGrid({
  products,
  lang,
  currency,
  dictionary,
  columns = 4,
  priority_count = 0,
  card_style,
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
            card_style={card_style}
          />
        </li>
      ))}
    </ul>
  );
}
