import "server-only";

import { randomBytes } from "node:crypto";

import type { Locale } from "@/i18nConfig";
import type { PricingDiscount } from "@/lib/checkout/pricing";
import { localized, type LocalizedText } from "@/lib/localized";
import { getFileUrl } from "@/lib/pocketbase/files";
import { createAdminPocketBase, createPublicPocketBase } from "@/lib/pocketbase/pocketbase-server";
import type { CartLinesInput } from "@/lib/schemas/checkout";
import type { ShippingRate, SiteSettings } from "@/lib/site-settings";
import type { ProductsResponse, ProductVariantsResponse } from "@/types/pocketbase-types";

// A line priced from the database. Stored as the checkout session snapshot, and later
// copied into order_items, so past orders never change when products do.
export type PricedLine = {
  variant_id: string;
  product_id: string;
  slug: string;
  title: string;
  variant_label: string;
  sku: string;
  image: string;
  unit_price: number;
  compare_at_price: number;
  quantity: number;
  line_total: number;
  stock: number;
};

export type PricedCart = {
  lines: PricedLine[];
  // Variants that no longer exist, aren't sold, or are out of stock.
  removed: string[];
  // Variants whose quantity was lowered to the stock left.
  adjusted: string[];
};

type ProductRecord = ProductsResponse<LocalizedText, string[], LocalizedText>;
type VariantWithProduct = ProductVariantsResponse<{ product?: ProductRecord }>;

// Prices with the public client, so hidden products and inactive variants can't be bought.
export async function priceLines(lines: CartLinesInput, locale: Locale): Promise<PricedCart> {
  const pb = createPublicPocketBase();
  const ids = [...new Set(lines.map((line) => line.variant_id))];
  const variants = await pb.collection("product_variants").getFullList<VariantWithProduct>({
    filter: ids.map((id, index) => pb.filter(`id = {:v${index}}`, { [`v${index}`]: id })).join(" || "),
    expand: "product",
  });

  const result: PricedCart = { lines: [], removed: [], adjusted: [] };
  for (const line of lines) {
    const variant = variants.find((item) => item.id === line.variant_id);
    const product = variant?.expand?.product;
    if (!variant || !product || variant.stock <= 0) {
      result.removed.push(line.variant_id);
      continue;
    }
    const quantity = Math.min(line.quantity, variant.stock);
    if (quantity < line.quantity) result.adjusted.push(line.variant_id);
    const unit_price = variant.price_override > 0 ? variant.price_override : product.price;
    const first_image = product.images?.[0];
    result.lines.push({
      variant_id: variant.id,
      product_id: product.id,
      slug: product.slug,
      title: localized(product.title, locale),
      variant_label: [variant.color, variant.size].filter(Boolean).join(" / "),
      sku: variant.sku,
      image: first_image ? getFileUrl(product, first_image, "100x100") : "",
      unit_price,
      compare_at_price: product.compare_at_price,
      quantity,
      line_total: unit_price * quantity,
      stock: variant.stock,
    });
  }
  return result;
}

export type FoundDiscount = { id: string; code: string; discount: PricingDiscount };

// Active, within its dates and under its usage limit. Discount codes are private, so this uses
// the admin client; it only ever returns the one code the customer typed.
export async function findDiscount(code: string): Promise<FoundDiscount | null> {
  if (!code) return null;
  const pb = await createAdminPocketBase();
  const record = await pb
    .collection("discount_codes")
    .getFirstListItem(pb.filter("code = {:code} && is_active = true", { code: code.toUpperCase() }))
    .catch(() => null);
  if (!record) return null;

  const now = Date.now();
  if (record.starts_at && new Date(record.starts_at).getTime() > now) return null;
  if (record.ends_at && new Date(record.ends_at).getTime() < now) return null;
  if (record.usage_limit > 0 && record.used_count >= record.usage_limit) return null;

  return {
    id: record.id,
    code: record.code,
    discount: { type: record.type, value: record.value, min_subtotal: record.min_subtotal },
  };
}

export function findShippingRate(settings: SiteSettings, id: string): ShippingRate | null {
  return settings.SHIPPING_RATES.find((rate) => rate.id === id) ?? null;
}

export function enabledPaymentMethods(settings: SiteSettings): ("card" | "cash_on_delivery")[] {
  const methods: ("card" | "cash_on_delivery")[] = [];
  if (settings.PAYMENT_METHODS.card) methods.push("card");
  if (settings.PAYMENT_METHODS.cash_on_delivery) methods.push("cash_on_delivery");
  return methods;
}

// PocketBase-style id (15 chars, a-z0-9), so batch requests can reference records created in the same batch.
export function newRecordId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...randomBytes(15)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

export const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;
