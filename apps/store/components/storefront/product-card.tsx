import Image from "next/image";
import Link from "next/link";

import type { StoreProductCard } from "@repo/core/actions/storefront";
import { discountPercent, ProductPrice } from "@/components/storefront/product-price";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { ThemeSettings } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

const MAX_SWATCHES = 5;

type ProductCardProps = {
  product: StoreProductCard;
  lang: string;
  currency: string;
  dictionary: Dictionary["store"]["card"];
  // Set on the first row so the largest images load first (LCP).
  is_priority?: boolean;
  // The theme's card style.
  card_style?: ThemeSettings["product_card"];
};

// What each theme card style changes: the frame, the image corners, the text and the badges.
const CARD_STYLES = {
  plain: { article: "", image: "rounded-lg", body: "", title: "", badge: "bg-background/90 rounded-full" },
  framed: {
    article: "bg-card rounded-lg border p-3",
    image: "rounded-md",
    body: "items-center text-center",
    title: "",
    badge: "bg-background/90 rounded-full",
  },
  minimal: {
    article: "",
    image: "rounded-none",
    body: "gap-0.5",
    title: "text-xs tracking-wide uppercase",
    badge: "bg-background/90 rounded-none",
  },
  bold: {
    article: "border-foreground border-2",
    image: "rounded-none",
    body: "px-3 pb-3",
    title: "font-semibold uppercase",
    badge: "bg-primary text-primary-foreground rounded-none",
  },
} as const;

export function ProductCard({
  product,
  lang,
  currency,
  dictionary,
  is_priority,
  card_style = "plain",
}: ProductCardProps) {
  const style = CARD_STYLES[card_style];
  const title = localized(product.title, lang as Locale);
  const discount = discountPercent(product.price, product.compare_at_price);
  const is_new = product.is_new;
  const extra_colors = product.colors.length - MAX_SWATCHES;

  return (
    <article className={cn("group relative flex flex-col gap-3", style.article)}>
      <div className={cn("bg-muted relative aspect-[3/4] overflow-hidden", style.image)}>
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
            <span className={cn("px-2.5 py-1 text-xs font-medium", style.badge)}>{dictionary.sold_out}</span>
          ) : discount > 0 ? (
            <span
              className={cn(
                "text-destructive px-2.5 py-1 text-xs font-semibold",
                style.badge,
                card_style === "bold" && "text-primary-foreground",
              )}
            >
              -{discount}%
            </span>
          ) : is_new ? (
            <span className={cn("px-2.5 py-1 text-xs font-medium", style.badge)}>{dictionary.new}</span>
          ) : null}
        </div>
        <WishlistButton product_id={product.id} dictionary={dictionary.wishlist} className="absolute top-2 right-2" />
      </div>

      <div className={cn("flex flex-col gap-1", style.body)}>
        <h3 className={cn("text-sm leading-snug font-medium", style.title)}>
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
