import "server-only";

import { after } from "next/server";

import { getBackend } from "@repo/core/backend/index";
import type { CheckoutSession, NewOrder } from "@repo/core/backend/types";
import { isLocale } from "@repo/core/i18nConfig";
import { findShippingRate } from "@repo/core/lib/checkout/checkout-server";
import { completeDraftForSession } from "@repo/core/lib/draft-orders";
import { localized } from "@repo/core/lib/localized";
import type { PaymentMethodConfig } from "@repo/core/lib/schemas/payments";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { SITE_URL } from "@repo/core/lib/site-config";
import type { Attribution } from "@repo/core/lib/tracking/attribution";
import { sendMetaEvent } from "@repo/core/lib/tracking/meta-capi";
import { BackendError } from "@repo/core/backend/errors";
import { issueGiftCardsForOrder } from "@repo/core/lib/gift-cards-server";

// The order fields for a checkout session whose details (email, addresses, totals, method) are
// saved on it. Shared by the checkout (cash on delivery, manual methods) and the Stripe webhook
// (cards), so both write the same order.
export function orderFromSession(
  session: CheckoutSession,
  settings: SiteSettings,
  payment: { status: "unpaid" | "paid"; provider_ref?: string },
): NewOrder | null {
  if (!session.shipping_address) return null;
  const locale = isLocale(session.locale) ? session.locale : settings.DEFAULT_LOCALE;
  const rate = findShippingRate(settings, session.shipping_method);
  return {
    user: session.user,
    email: session.email,
    phone: session.shipping_address.phone,
    locale,
    status: payment.status === "paid" ? "paid" : "pending",
    payment_status: payment.status,
    payment_method: session.payment_method || "manual",
    currency: session.currency || settings.CURRENCY,
    subtotal: session.subtotal,
    discount_total: session.discount_total,
    shipping_total: session.shipping_total,
    tax_total: session.tax_total,
    cod_fee: session.cod_fee,
    total: session.total,
    discount_code: session.discount_code,
    shipping_address: session.shipping_address,
    billing_address: session.billing_address,
    shipping_method: rate ? localized(rate.name, locale) || rate.id : session.shipping_method,
    customer_note: session.customer_note,
    checkout_session: session.id,
    attribution: orderAttribution(session.attribution),
    gift_card_total: session.gift_card_amount,
    payment:
      payment.status === "paid"
        ? { provider_ref: payment.provider_ref ?? "", status: "succeeded" }
        : { provider_ref: "", status: "pending" },
  };
}

// Places the order for a session that's ready (all details saved). Stock, the order's items,
// the payment row and the session's "completed" status happen in one step in the backend.
export async function placeSessionOrder(
  session: CheckoutSession,
  settings: SiteSettings,
  payment: { status: "unpaid" | "paid"; provider_ref?: string },
): Promise<{ order_number: number } | null> {
  const order = orderFromSession(session, settings, payment);
  if (!order) return null;
  const backend = getBackend();
  // The gift card's part is taken first, only if its balance still covers it.
  const gift_card_amount = session.gift_card_id ? session.gift_card_amount : 0;
  if (gift_card_amount > 0) {
    const is_redeemed = await backend.gift_cards.redeem(session.gift_card_id, gift_card_amount, {
      order_id: "",
      note: `checkout ${session.id}`,
    });
    if (!is_redeemed) throw new BackendError("gift_card_unavailable");
  }
  let placed: { order_number: number };
  try {
    placed = await backend.checkout.placeOrder(order, session.line_items, { status: "completed" });
  } catch (error) {
    // No order: the gift card gets its money back.
    if (gift_card_amount > 0) {
      await backend.gift_cards.credit(session.gift_card_id, gift_card_amount, {
        order_id: "",
        note: `checkout ${session.id}`,
      });
    }
    throw error;
  }
  await completeDraftForSession(session, placed.order_number);
  if (payment.status === "paid") {
    after(async () => {
      const order_id = await backend.orders.getIdByNumber(placed.order_number);
      if (order_id) await issueGiftCardsForOrder(order_id);
    });
  }
  sendServerPurchase(session, order);
  return placed;
}

// Browser data stays on the session; the order keeps where the customer came from.
const PRIVATE_KEYS = new Set(["consent_marketing", "client_ip", "user_agent", "fbp", "fbc"]);
function orderAttribution(attribution: Attribution | null): Attribution | null {
  if (!attribution) return null;
  const kept = Object.fromEntries(Object.entries(attribution).filter(([key]) => !PRIVATE_KEYS.has(key)));
  return Object.keys(kept).length > 0 ? kept : null;
}

// The server copy of the Purchase event, with the checkout session id as event_id (the thank-you
// page sends the browser copy with the same id). Only with marketing consent, after the response.
function sendServerPurchase(session: CheckoutSession, order: NewOrder) {
  const attribution = session.attribution;
  if (attribution?.consent_marketing !== "1") return;
  after(() =>
    sendMetaEvent({
      event_name: "Purchase",
      event_id: session.id,
      event_source_url: `${SITE_URL}/${order.locale}/checkout/${session.id}/thank-you`,
      user: {
        email: order.email,
        phone: order.phone,
        external_id: order.user || undefined,
        client_ip: attribution.client_ip,
        user_agent: attribution.user_agent,
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        country: order.shipping_address.country,
      },
      custom_data: {
        currency: order.currency,
        value: order.total / 100,
        content_type: "product",
        content_ids: session.line_items.map((line) => line.variant_id || line.title),
        num_items: session.line_items.reduce((sum, line) => sum + line.quantity, 0),
      },
    }),
  );
}

// A payment method as the customer sees it, in their language.
export type CheckoutPaymentMethod = {
  id: string;
  type: PaymentMethodConfig["type"];
  name: string;
  instructions: string;
  fee: number;
};

export function viewPaymentMethod(method: PaymentMethodConfig, locale: string): CheckoutPaymentMethod {
  const lang = isLocale(locale) ? locale : "en";
  return {
    id: method.id,
    type: method.type,
    name: localized(method.name, lang) || method.id,
    instructions: localized(method.instructions, lang),
    fee: method.fee,
  };
}
