import type { ShopFacets, StoreColor, StoreProductCard } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import { compareSizes } from "@repo/core/lib/size-order";

// Storefront card and filter logic shared by every backend: backends load the rows,
// these functions decide price, colors, sold-out and "new".

const NEW_FOR_DAYS = 30;

type VariantRow = { size: string; color: string; color_hex: string; price_override: number; stock: number };

export function variantPrice(variant: Pick<VariantRow, "price_override">, product_price: number): number {
  return variant.price_override > 0 ? variant.price_override : product_price;
}

function uniqueColors(variants: Pick<VariantRow, "color" | "color_hex">[]): StoreColor[] {
  const colors = new Map<string, StoreColor>();
  for (const variant of variants) {
    if (variant.color && !colors.has(variant.color.toLowerCase())) {
      colors.set(variant.color.toLowerCase(), { name: variant.color, hex: variant.color_hex });
    }
  }
  return [...colors.values()];
}

export function buildProductCard(
  product: {
    id: string;
    slug: string;
    title: LocalizedText;
    // Image URLs, main image first.
    images: string[];
    price: number;
    compare_at_price: number;
    created_at: string;
  },
  // The product's sellable variants.
  variants: VariantRow[],
): StoreProductCard {
  const prices = variants.map((variant) => variantPrice(variant, product.price));
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    image: product.images[0] ?? "",
    hover_image: product.images[1] ?? "",
    price: prices.length > 0 ? Math.min(...prices) : product.price,
    has_price_range: new Set(prices).size > 1,
    compare_at_price: product.compare_at_price,
    colors: uniqueColors(variants),
    // A product without variants can't be added to the cart either.
    is_sold_out: variants.every((variant) => variant.stock <= 0),
    created_at: product.created_at,
    is_new: Date.now() - new Date(product.created_at).getTime() < NEW_FOR_DAYS * 86_400_000,
  };
}

export function buildFacets(variants: Pick<VariantRow, "size" | "color" | "color_hex">[]): ShopFacets {
  const sizes = [...new Set(variants.map((variant) => variant.size).filter(Boolean))].sort(compareSizes);
  return { sizes, colors: uniqueColors(variants).sort((a, b) => a.name.localeCompare(b.name)) };
}
