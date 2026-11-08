import { cn } from "@repo/ui/lib/utils";
import { formatCurrency } from "@repo/core/lib/utils/format";

type ProductPriceProps = {
  price: number;
  compare_at_price: number;
  currency: string;
  lang: string;
  // "From {price}" when variants have different prices.
  from_label?: string;
  size?: "sm" | "lg";
};

// Sale price + crossed-out original price when compare_at_price is higher.
export function ProductPrice({ price, compare_at_price, currency, lang, from_label, size = "sm" }: ProductPriceProps) {
  const is_on_sale = compare_at_price > price;
  const formatted = formatCurrency(price, currency, lang);

  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", size === "lg" ? "text-2xl" : "text-sm")}>
      <span className={cn("font-medium tabular-nums", is_on_sale && "text-destructive")}>
        {from_label ? from_label.replace("{price}", formatted) : formatted}
      </span>
      {is_on_sale && (
        <s className={cn("text-muted-foreground tabular-nums", size === "lg" ? "text-base" : "text-xs")}>
          {formatCurrency(compare_at_price, currency, lang)}
        </s>
      )}
    </p>
  );
}

export function discountPercent(price: number, compare_at_price: number): number {
  return compare_at_price > price ? Math.round((1 - price / compare_at_price) * 100) : 0;
}
