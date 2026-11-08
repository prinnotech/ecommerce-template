import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, CheckoutSession, DraftOrder } from "@repo/core/backend/types";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { findShippingRate, priceLines, type PricedLine } from "@repo/core/lib/checkout/checkout-server";
import { computeTotals, type Totals } from "@repo/core/lib/checkout/pricing";
import { buildOrderEmail } from "@repo/core/lib/email/order-emails";
import { taxRateFor } from "@repo/core/lib/shipping";
import { sendEmail } from "@repo/core/lib/email/transport";
import { localized } from "@repo/core/lib/localized";
import type { SiteSettings } from "@repo/core/lib/site-settings";

// Draft orders are priced by the same rules as the checkout: catalog prices for products, the
// typed price for custom lines, then shipping (the draft's own price, or the method's),
// the draft's discount and taxes.

type DraftPricing = Pick<
  DraftOrder,
  "lines" | "locale" | "shipping_method" | "shipping_price" | "discount" | "shipping_address"
>;

export type PricedDraft = {
  lines: PricedLine[];
  // Variant ids that can't be sold any more (deleted, hidden, out of stock) or were lowered to the stock left.
  removed: string[];
  adjusted: string[];
  totals: Totals;
};

export function draftLocale(draft: Pick<DraftOrder, "locale">, settings: SiteSettings): Locale {
  if (isLocale(draft.locale)) return draft.locale;
  return isLocale(settings.DEFAULT_LOCALE) ? settings.DEFAULT_LOCALE : LOCALES[0];
}

// `country` overrides the draft's own address (the checkout passes the country the customer typed).
export function draftTotals(
  lines: PricedLine[],
  draft: Pick<DraftOrder, "shipping_method" | "shipping_price" | "discount" | "shipping_address">,
  settings: SiteSettings,
  payment_fee: number,
  country = draft.shipping_address?.country ?? "",
): Totals {
  const has_own_price = draft.shipping_price !== null;
  return computeTotals({
    lines,
    shipping_price: has_own_price
      ? draft.shipping_price
      : (findShippingRate(settings, draft.shipping_method)?.price ?? null),
    // A shipping price typed on the draft is final: the free-shipping offer doesn't apply.
    free_shipping_threshold: has_own_price ? 0 : settings.FREE_SHIPPING_THRESHOLD,
    discount: draft.discount ? { type: draft.discount.type, value: draft.discount.value, min_subtotal: 0 } : null,
    tax_rate: taxRateFor(settings, country),
    tax_included: settings.TAX_INCLUDED,
    payment_fee,
  });
}

export async function priceDraft(draft: DraftPricing, settings: SiteSettings): Promise<PricedDraft> {
  const locale = draftLocale(draft, settings);
  const priced = await priceLines(
    draft.lines
      .filter((line) => line.variant_id)
      .map((line) => ({ variant_id: line.variant_id, quantity: line.quantity })),
    locale,
  );
  // Back in the draft's order, custom lines included.
  const lines: PricedLine[] = [];
  draft.lines.forEach((line, index) => {
    if (line.variant_id) {
      const match = priced.lines.find((item) => item.variant_id === line.variant_id);
      if (match) lines.push(match);
      return;
    }
    lines.push({
      variant_id: "",
      product_id: "",
      slug: "",
      title: line.title,
      variant_label: "",
      sku: "",
      image: "",
      unit_price: line.unit_price,
      compare_at_price: 0,
      quantity: line.quantity,
      line_total: line.unit_price * line.quantity,
      // Custom lines have no stock; the index keeps their React key stable.
      stock: -1 - index,
    });
  });
  return { lines, removed: priced.removed, adjusted: priced.adjusted, totals: draftTotals(lines, draft, settings, 0) };
}

// A checkout session opened from a draft's invoice keeps the draft's lines, shipping price and
// discount (the customer can't change them).
export async function draftForSession(session_id: string): Promise<DraftOrder | null> {
  return getBackend().draft_orders.bySession(session_id);
}

// After a session's order is placed: the draft it came from (if any) points at the order.
export async function completeDraftForSession(session: CheckoutSession, order_number: number): Promise<void> {
  const draft = await draftForSession(session.id);
  if (!draft) return;
  const order_id = await getBackend().orders.getIdByNumber(order_number);
  if (order_id) await getBackend().draft_orders.complete(draft.id, order_id);
}

// The draft shaped like an order, so the invoice email uses the same layout and placeholders.
function draftAsOrder(draft: DraftOrder, priced: PricedDraft, settings: SiteSettings): AdminOrderDetail {
  const shipping_rate = findShippingRate(settings, draft.shipping_method);
  const locale = draftLocale(draft, settings);
  const { is_free_shipping: _is_free_shipping, ...totals } = priced.totals;
  return {
    id: draft.id,
    order_number: draft.draft_number,
    created_at: draft.created_at,
    status: "pending",
    payment_status: "unpaid",
    payment_method: "",
    email: draft.email,
    phone: draft.phone,
    locale,
    shipping_address: draft.shipping_address,
    billing_address: null,
    shipping_method: shipping_rate ? localized(shipping_rate.name, locale) || shipping_rate.id : "",
    customer_note: "",
    internal_note: "",
    attribution: null,
    refunded_total: 0,
    refunds: [],
    gift_card_total: 0,
    checkout_session_id: "",
    tracking_number: "",
    carrier: "",
    tracking_url: "",
    paid_at: "",
    shipped_at: "",
    delivered_at: "",
    cancelled_at: "",
    items: priced.lines.map((line, index) => ({
      id: String(index),
      product: line.product_id,
      variant: line.variant_id,
      title: line.title,
      variant_label: line.variant_label,
      sku: line.sku,
      image: line.image,
      unit_price: line.unit_price,
      quantity: line.quantity,
      line_total: line.line_total,
    })),
    events: [],
    payments: [],
    customer: null,
    discount_code: "",
    currency: draft.currency || settings.CURRENCY,
    ...totals,
  };
}

export async function sendDraftInvoiceEmail(
  draft: DraftOrder,
  priced: PricedDraft,
  settings: SiteSettings,
  invoice_link: string,
): Promise<boolean> {
  const email = await buildOrderEmail("draft_invoice", draftAsOrder(draft, priced, settings), {
    ignore_disabled: true,
    extra: {
      invoice_link,
      order_number: `D${draft.draft_number}`,
      customer_name: draft.customer_name || draft.shipping_address?.full_name || draft.email,
    },
  });
  if (!email) return false;
  const result = await sendEmail({ ...email, template: "draft_invoice", order_id: "" });
  return result.ok;
}
