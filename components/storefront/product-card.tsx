import Image from "next/image";
import Link from "next/link";

import type { StoreProductCard } from "@/app/actions/storefront";
import { discountPercent, ProductPrice } from "@/components/storefront/product-price";
import type { Locale } from "@/i18nConfig";
import type { Dictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { cn } from "@/lib/utils";

const MAX_SWATCHES = 5;

type ProductCardProps = {
  product: StoreProductCard;
  lang: string;
  currency: string;
  dictionary: Dictionary["store"]["card"];
  // Set on the first row so the largest images load first (LCP).
  is_priority?: boolean;
};

export function ProductCard({ product, lang, currency, dictionary, is_priority }: ProductCardProps) {
  const title = localized(product.title, lang as Locale);
  const discount = discountPercent(product.price, product.compare_at_price);
  const is_new = product.is_new;
  const extra_colors = product.colors.length - MAX_SWATCHES;

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="bg-muted relative aspect-[3/4] overflow-hidden rounded-lg">
        {product.image ? (
          <>
            <Image
              src={product.image}
              alt={title}
              fill
              priority={is_priority}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className={cn(
                "object-cover transition duration-500 group-hover:scale-[1.03]",
                product.hover_image && "group-hover:opacity-0",
              )}
            />
            {product.hover_image && (
              <Image
                src={product.hover_image}
                alt=""
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="object-cover opacity-0 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          // No photo yet: a calm placeholder with the product name instead of a broken image.
          <div className="from-muted to-secondary flex size-full items-center justify-center bg-gradient-to-br p-6">
            <span className="font-display text-muted-foreground line-clamp-3 text-center text-xl">{title}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {product.is_sold_out ? (
            <span className="bg-background/90 rounded-full px-2.5 py-1 text-xs font-medium">{dictionary.sold_out}</span>
          ) : discount > 0 ? (
            <span className="bg-background/90 text-destructive rounded-full px-2.5 py-1 text-xs font-semibold">
              -{discount}%
            </span>
          ) : is_new ? (
            <span className="bg-background/90 rounded-full px-2.5 py-1 text-xs font-medium">{dictionary.new}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm leading-snug font-medium">
          <Link href={`/${lang}/shop/${product.slug}`} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        <ProductPrice
          price={product.price}
          compare_at_price={product.compare_at_price}
          currency={currency}
          lang={lang}
          from_label={product.has_price_range ? dictionary.from : undefined}
        />
        {product.colors.length > 1 && (
          <ul className="mt-1 flex items-center gap-1.5" aria-label={dictionary.colors}>
            {product.colors.slice(0, MAX_SWATCHES).map((color) => (
              <li
                key={color.name}
                title={color.name}
                className="ring-border size-3.5 rounded-full ring-1 ring-offset-1"
                style={{ backgroundColor: color.hex || undefined }}
              >
                <span className="sr-only">{color.name}</span>
              </li>
            ))}
            {extra_colors > 0 && (
              <li className="text-muted-foreground text-xs">
                {dictionary.more_colors.replace("{count}", String(extra_colors))}
              </li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
}
