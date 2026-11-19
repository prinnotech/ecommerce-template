import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { DiscountCode } from "@repo/core/backend/types";
import type { Locale } from "@repo/core/i18nConfig";
import type { PricingDiscount } from "@repo/core/lib/checkout/pricing";
import { localized } from "@repo/core/lib/localized";
import { variantPrice } from "@repo/core/lib/product-cards";
import type { CartLinesInput } from "@repo/core/lib/schemas/checkout";
import type { DiscountAppliesTo } from "@repo/core/lib/schemas/discounts";
import type { ShippingRate, SiteSettings } from "@repo/core/lib/site-settings";
import type { PaymentMethodConfig } from "@repo/core/lib/schemas/payments";
import { isStripeReady } from "@repo/core/lib/stripe/stripe-server";
import { allShippingRates, shippingRatesFor } from "@repo/core/lib/shipping";

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

// Only sellable variants come back (public visibility rules), so hidden products and
// inactive variants can't be bought.
export async function priceLines(lines: CartLinesInput, locale: Locale): Promise<PricedCart> {
  const ids = [...new Set(lines.map((line) => line.variant_id))];
  const variants = ids.length > 0 ? await getBackend().checkout.pricingVariants(ids) : [];

  const result: PricedCart = { lines: [], removed: [], adjusted: [] };
  for (const line of lines) {
    const variant = variants.find((item) => item.variant_id === line.variant_id);
    if (!variant || variant.stock <= 0) {
      result.removed.push(line.variant_id);
      continue;
    }
    const quantity = Math.min(line.quantity, variant.stock);
    if (quantity < line.quantity) result.adjusted.push(line.variant_id);
    const unit_price = variantPrice(variant, variant.product_price);
    result.lines.push({
      variant_id: variant.variant_id,
      product_id: variant.product_id,
      slug: variant.slug,
      title: localized(variant.title, locale),
      variant_label: [variant.color, variant.size].filter(Boolean).join(" / "),
      sku: variant.sku,
      image: variant.image,
      unit_price,
      compare_at_price: variant.compare_at_price,
      quantity,
      line_total: unit_price * quantity,
      stock: variant.stock,
    });
  }
  return result;
}

export type FoundDiscount = { id: string; code: string; once_per_customer: boolean; discount: PricingDiscount };

function isLive(record: DiscountCode, now: number): boolean {
  if (!record.is_active) return false;
  if (record.starts_at && new Date(record.starts_at).getTime() > now) return false;
  if (record.ends_at && new Date(record.ends_at).getTime() < now) return false;
  return !(record.usage_limit > 0 && record.used_count >= record.usage_limit);
}

// Product ids a part of a discount is limited to (null = every product). Categories are looked up
// once per request.
type CategoryLookup = (category_ids: string[]) => Promise<string[]>;

function categoryLookup(): CategoryLookup {
  const cache = new Map<string, Promise<string[]>>();
  return (category_ids) => {
    const key = [...category_ids].sort().join(",");
    let found = cache.get(key);
    if (!found) {
      found = getBackend().discounts.productIdsInCategories(category_ids);
      cache.set(key, found);
    }
    return found;
  };
}

async function productIds(applies_to: DiscountAppliesTo, lookup: CategoryLookup): Promise<string[] | null> {
  if (applies_to.kind === "products") return applies_to.ids;
  if (applies_to.kind === "categories") return lookup(applies_to.ids);
  return null;
}

async function toPricingDiscount(
  record: DiscountCode,
  is_code: boolean,
  lookup: CategoryLookup,
): Promise<PricingDiscount> {
  const deal = record.buy_x_get_y;
  return {
    id: record.id,
    // Automatic discounts show their name; codes show the code.
    label: record.method === "automatic" ? record.title || record.code : record.code,
    type: record.type,
    value: record.value,
    min_subtotal: record.min_subtotal,
    product_ids: record.type === "buy_x_get_y" ? null : await productIds(record.applies_to, lookup),
    buy_x_get_y:
      record.type === "buy_x_get_y" && deal
        ? {
            buy: {
              kind: deal.buy.kind,
              value: deal.buy.value,
              product_ids: await productIds(deal.buy.applies_to, lookup),
            },
            get: {
              quantity: deal.get.quantity,
              percent: deal.get.percent,
              product_ids: await productIds(deal.get.applies_to, lookup),
            },
            max_uses: deal.max_uses,
          }
        : null,
    combines_with: record.combines_with,
    is_code,
  };
}

// Active, within its dates and under its usage limit. Discount codes are private; this only
// ever returns the one code the customer typed.
export async function findDiscount(code: string): Promise<FoundDiscount | null> {
  if (!code) return null;
  const record = await getBackend().checkout.findDiscount(code.toUpperCase());
  if (!record || record.method !== "code" || !isLive(record, Date.now())) return null;
  return {
    id: record.id,
    code: record.code,
    once_per_customer: record.once_per_customer,
    discount: await toPricingDiscount(record, true, categoryLookup()),
  };
}

// Every automatic discount live now, for computeTotals to pick from.
export async function liveAutomaticDiscounts(): Promise<PricingDiscount[]> {
  const now = Date.now();
  const lookup = categoryLookup();
  const records = (await getBackend().checkout.automaticDiscounts()).filter((record) => isLive(record, now));
  return Promise.all(records.map((record) => toPricingDiscount(record, false, lookup)));
}

// "Once per customer": an earlier order (not cancelled) by the same email used it.
export async function isDiscountUsedBy(found: FoundDiscount, email: string): Promise<boolean> {
  if (!found.once_per_customer || !email) return false;
  return (await getBackend().discounts.usesByEmail(found.id, email)) > 0;
}

// Any zone's rate, by id (to name a stored method).
export function findShippingRate(settings: SiteSettings, id: string): ShippingRate | null {
  return allShippingRates(settings).find((rate) => rate.id === id) ?? null;
}

// The rate only if a customer in `country` may choose it.
export function findShippingRateFor(settings: SiteSettings, id: string, country: string): ShippingRate | null {
  return shippingRatesFor(settings, country).find((rate) => rate.id === id) ?? null;
}

// The methods the checkout offers, in the owner's order. Card payments show only once Stripe is
// fully set up (both keys).
export async function checkoutPaymentMethods(settings: SiteSettings): Promise<PaymentMethodConfig[]> {
  const enabled = settings.PAYMENT_METHODS.filter((method) => method.is_enabled);
  const has_stripe = enabled.some((method) => method.type === "stripe") && (await isStripeReady(settings));
  return enabled.filter((method) => method.type !== "stripe" || has_stripe);
}

export const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;
