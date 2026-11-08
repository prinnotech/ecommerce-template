"use server";

import type Stripe from "stripe";
import { z } from "zod";

import { getMyAddresses, type Address } from "@repo/core/actions/account";
import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { CheckoutSession, CheckoutTotalsFields, GiftCard } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { getCurrentUser } from "@repo/core/lib/auth";
import {
  CHECKOUT_TTL_MS,
  checkoutPaymentMethods,
  findDiscount,
  findShippingRateFor,
  isDiscountUsedBy,
  priceLines,
  type FoundDiscount,
  type PricedCart,
  type PricedLine,
} from "@repo/core/lib/checkout/checkout-server";
import { placeSessionOrder, viewPaymentMethod, type CheckoutPaymentMethod } from "@repo/core/lib/checkout/place-order";
import { computeTotals, type Totals } from "@repo/core/lib/checkout/pricing";
import { draftForSession, draftTotals } from "@repo/core/lib/draft-orders";
import { shippingRatesFor, taxRateFor } from "@repo/core/lib/shipping";
import { sendOrderEmails } from "@repo/core/lib/email/order-emails";
import { getDictionary, isLocale } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { getClientIp, isRateLimited } from "@repo/core/lib/rate-limit";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import { email_schema } from "@repo/core/lib/schemas/auth";
import {
  complete_checkout_schema,
  create_checkout_schema,
  quote_checkout_schema,
  type CompleteCheckoutInput,
  type CreateCheckoutInput,
  type QuoteCheckoutInput,
} from "@repo/core/lib/schemas/checkout";
import { id_schema } from "@repo/core/lib/schemas/ids";
import type { PaymentMethodConfig } from "@repo/core/lib/schemas/payments";
import { reportError } from "@repo/core/lib/server-log";
import { SITE_URL } from "@repo/core/lib/site-config";
import type { ShippingRate, SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getStripe, stripeCurrency } from "@repo/core/lib/stripe/stripe-server";
import { cookies, headers } from "next/headers";
import { parseAttribution, type Attribution } from "@repo/core/lib/tracking/attribution";
import { parseConsent } from "@repo/core/lib/tracking/consent";
import { CONSENT_COOKIE, FBC_COOKIE, FBP_COOKIE, TRACKING_COOKIE } from "@repo/core/lib/tracking/tracking-params";
import { findUsableGiftCard, isUnusableGiftCard } from "@repo/core/lib/gift-cards-server";
import { maskGiftCardCode } from "@repo/core/lib/schemas/gift-cards";

// Checkout sessions are private to the server. Possessing the session id (random, only ever
// given to the browser that created it) is what authorizes access to that one session, like a
// Stripe Checkout Session URL.

const session_id_schema = id_schema;

export type CheckoutShippingRate = { id: string; name: string; price: number; min_days: number; max_days: number };
export type { CheckoutPaymentMethod };

export type CheckoutView = {
  id: string;
  locale: string;
  currency: string;
  email: string;
  lines: PricedLine[];
  totals: Totals;
  shipping_method: string;
  payment_method: string;
  discount_code: string;
  shipping_rates: CheckoutShippingRate[];
  payment_methods: CheckoutPaymentMethod[];
  // The card form loads Stripe with it ("" when card payments are off).
  stripe_publishable_key: string;
  free_shipping_threshold: number;
  tax_included: boolean;
  tax_rate: number;
  // The store's country (STORE_ADDRESS.country) is pre-selected in the address form (audit X9).
  store_country: string;
  user: { email: string; name: string } | null;
  saved_addresses: Address[];
  expires_at: string;
  // Opened from a draft order's invoice: the items, shipping price and discount are fixed.
  is_draft: boolean;
  // The draft's address, to start the form with.
  shipping_address: AddressFields | null;
  gift_card: AppliedGiftCard | null;
};

export type CheckoutState = { status: "open"; checkout: CheckoutView } | { status: "completed" };

// `country` is the delivery country ("" before it's known): it picks the zone's rates and tax.
function totalsFor(
  settings: SiteSettings,
  lines: PricedLine[],
  shipping_method: string,
  method: PaymentMethodConfig | undefined,
  discount: FoundDiscount | null,
  country: string,
): Totals {
  return computeTotals({
    lines,
    shipping_price: findShippingRateFor(settings, shipping_method, country)?.price ?? null,
    free_shipping_threshold: settings.FREE_SHIPPING_THRESHOLD,
    discount: discount?.discount ?? null,
    tax_rate: taxRateFor(settings, country),
    tax_included: settings.TAX_INCLUDED,
    payment_fee: paymentFee(method),
  });
}

// Card payments have no fee; cash on delivery and manual methods may.
function paymentFee(method: PaymentMethodConfig | undefined): number {
  return method?.type === "stripe" ? 0 : (method?.fee ?? 0);
}

function totalsFields(totals: Totals): CheckoutTotalsFields {
  return {
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    shipping_total: totals.shipping_total,
    tax_total: totals.tax_total,
    cod_fee: totals.cod_fee,
    total: totals.total,
  };
}

async function loadOpenSession(id: string): Promise<CheckoutSession | "expired" | "completed" | null> {
  if (!session_id_schema.safeParse(id).success) return null;
  const session = await getBackend().checkout.getSession(id);
  if (!session) return null;
  if (session.status === "completed") return "completed";
  if (session.status !== "open" || new Date(session.expires_at).getTime() < Date.now()) return "expired";
  return session;
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<ActionResult<{ id: string }>> {
  const parsed = create_checkout_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  const ip = await getClientIp();
  if (isRateLimited(`checkout_create:${ip}`, 30, 10 * 60_000)) return fail("rate_limited");

  try {
    const [settings, user, priced] = await Promise.all([
      getSiteSettings(),
      getCurrentUser(),
      priceLines(parsed.data.lines, parsed.data.locale),
    ]);
    if (priced.lines.length === 0) return fail("out_of_stock");

    const methods = await checkoutPaymentMethods(settings);
    const country = settings.STORE_ADDRESS.country;
    const shipping_method = shippingRatesFor(settings, country)[0]?.id ?? "";
    const totals = totalsFor(settings, priced.lines, shipping_method, methods[0], null, country);

    const attribution = await requestAttribution();
    const created = await getBackend().checkout.createSession({
      attribution,
      user: user?.id ?? "",
      email: user?.email ?? "",
      locale: parsed.data.locale,
      line_items: priced.lines,
      ...totalsFields(totals),
      currency: settings.CURRENCY,
      shipping_method,
      payment_method: methods[0]?.id ?? "",
      discount_code: "",
      status: "open",
      expires_at: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
    });
    // A signed-in customer's email is known now: the checkout can be recovered if left.
    if (user?.email) await getBackend().abandoned_checkouts.saveContact(created.id, user.email);
    return ok(created);
  } catch (error) {
    return failFrom(error, "checkout", "createCheckoutSession");
  }
}

export async function getCheckout(id: string): Promise<ActionResult<CheckoutState>> {
  try {
    const session = await loadOpenSession(id);
    if (!session) return fail("not_found");
    if (session === "completed") return ok({ status: "completed" });
    if (session === "expired") return fail("checkout_expired");

    const [settings, user] = await Promise.all([getSiteSettings(), getCurrentUser()]);
    const locale = isLocale(session.locale) ? session.locale : settings.DEFAULT_LOCALE;
    const discount_code = session.discount_code
      ? await getBackend().checkout.getDiscountCode(session.discount_code)
      : null;
    const addresses = user ? await getMyAddresses() : null;
    const methods = await checkoutPaymentMethods(settings);
    const has_card = methods.some((method) => method.type === "stripe");
    const draft = await draftForSession(session.id);
    // Rates for the country the form starts with: the default saved address, the draft's
    // address, else the store's country.
    const default_address = addresses?.ok
      ? (addresses.data.find((address) => address.is_default) ?? addresses.data[0])
      : undefined;
    const country = default_address?.country || session.shipping_address?.country || settings.STORE_ADDRESS.country;
    const rates = shippingRatesFor(settings, country);

    return ok({
      status: "open",
      checkout: {
        id: session.id,
        locale,
        currency: session.currency || settings.CURRENCY,
        email: session.email || user?.email || "",
        lines: session.line_items,
        totals: {
          subtotal: session.subtotal,
          discount_total: session.discount_total,
          shipping_total: session.shipping_total,
          is_free_shipping:
            settings.FREE_SHIPPING_THRESHOLD > 0 &&
            session.subtotal - session.discount_total >= settings.FREE_SHIPPING_THRESHOLD,
          cod_fee: session.cod_fee,
          tax_total: session.tax_total,
          total: session.total,
        },
        shipping_method: rates.some((rate) => rate.id === session.shipping_method)
          ? session.shipping_method
          : (rates[0]?.id ?? ""),
        payment_method: methods.some((method) => method.id === session.payment_method)
          ? session.payment_method
          : (methods[0]?.id ?? ""),
        discount_code: discount_code ?? "",
        shipping_rates: viewRates(rates, locale),
        payment_methods: methods.map((method) => viewPaymentMethod(method, locale)),
        stripe_publishable_key: has_card ? settings.STRIPE_PUBLISHABLE_KEY : "",
        free_shipping_threshold: settings.FREE_SHIPPING_THRESHOLD,
        tax_included: settings.TAX_INCLUDED,
        tax_rate: taxRateFor(settings, country),
        store_country: settings.STORE_ADDRESS.country,
        user: user ? { email: user.email, name: user.name } : null,
        saved_addresses: addresses?.ok ? addresses.data : [],
        expires_at: session.expires_at,
        is_draft: draft !== null,
        shipping_address: session.shipping_address,
        gift_card: session.gift_card_id
          ? giftCardApplied(
              await getBackend()
                .gift_cards.get(session.gift_card_id)
                .catch(() => null),
              {
                ...session,
                is_free_shipping: false,
              },
            )
          : null,
      },
    });
  } catch (error) {
    return failFrom(error, "checkout", "getCheckout");
  }
}

export type AppliedGiftCard = { code: string; masked: string; amount: number; balance: number };

export type CheckoutQuote = {
  totals: Totals;
  discount_code: string;
  gift_card: AppliedGiftCard | null;
  is_discount_invalid: boolean;
  // The typed code is a gift card that is used up, expired or switched off.
  is_gift_card_unusable: boolean;
  // The rates for the chosen country, and the method kept (the first one if the old one isn't offered).
  shipping_rates: CheckoutShippingRate[];
  shipping_method: string;
};

function viewRates(rates: ShippingRate[], locale: string): CheckoutShippingRate[] {
  return rates.map((rate) => ({
    id: rate.id,
    name: localized(rate.name, isLocale(locale) ? locale : "en") || rate.id,
    price: rate.price,
    min_days: rate.min_days,
    max_days: rate.max_days,
  }));
}

// Recomputes totals when the shipping method, payment method or discount code changes.
export async function quoteCheckout(input: QuoteCheckoutInput): Promise<ActionResult<CheckoutQuote>> {
  const parsed = quote_checkout_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { session_id, payment_method, country } = parsed.data;

  try {
    const session = await loadOpenSession(session_id);
    if (!session || session === "completed") return fail("not_found");
    if (session === "expired") return fail("checkout_expired");

    const settings = await getSiteSettings();
    const method = (await checkoutPaymentMethods(settings)).find((item) => item.id === payment_method);
    if (!method) return fail("invalid_input");
    // A country change can change the rates on offer: keep the method only if it's still there.
    const rates = shippingRatesFor(settings, country);
    const shipping_method = rates.some((rate) => rate.id === parsed.data.shipping_method)
      ? parsed.data.shipping_method
      : (rates[0]?.id ?? "");

    const draft = await draftForSession(session.id);
    // One field for both: a code that isn't a discount may be a gift card.
    const typed = parsed.data.discount_code;
    const discount = draft ? null : await findDiscount(typed);
    const typed_card = typed && !discount ? await findUsableGiftCard(typed, settings) : null;
    const card =
      typed_card ??
      (parsed.data.gift_card_code ? await findUsableGiftCard(parsed.data.gift_card_code, settings) : null);
    const kept_discount =
      typed_card && !draft
        ? await findDiscount((await getBackend().checkout.getDiscountCode(session.discount_code)) ?? "")
        : discount;
    const totals = draft
      ? draftTotals(session.line_items, { ...draft, shipping_method }, settings, paymentFee(method), country)
      : totalsFor(settings, session.line_items, shipping_method, method, kept_discount, country);
    const gift = giftCardApplied(card, totals);
    const is_code_rejected = Boolean(typed) && !discount && !typed_card;
    const is_gift_card_unusable = is_code_rejected && (await isUnusableGiftCard(typed, settings));

    await getBackend().checkout.updateSession(session_id, {
      shipping_method,
      payment_method,
      discount_code: kept_discount?.id ?? "",
      gift_card_id: card?.id ?? "",
      gift_card_amount: gift?.amount ?? 0,
      ...totalsFields(totals),
    });
    return ok({
      totals,
      discount_code: kept_discount?.code ?? "",
      gift_card: gift,
      is_discount_invalid: is_code_rejected && !is_gift_card_unusable,
      is_gift_card_unusable,
      shipping_rates: viewRates(rates, session.locale),
      shipping_method,
    });
  } catch (error) {
    return failFrom(error, "checkout", "quoteCheckout");
  }
}

// Cash on delivery and manual methods: the order is placed now. Card: a Stripe Checkout Session
// is created and its client secret returned; the card form confirms the payment with Stripe and
// the webhook (apps/store/app/api/stripe/webhook) places the order once Stripe says it's paid.
export type CheckoutCompletion = { kind: "order"; order_number: number } | { kind: "stripe"; client_secret: string };

export async function completeCheckout(input: CompleteCheckoutInput): Promise<ActionResult<CheckoutCompletion>> {
  const parsed = complete_checkout_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const data = parsed.data;

  const ip = await getClientIp();
  if (isRateLimited(`checkout_complete:${ip}`, 10, 10 * 60_000)) return fail("rate_limited");

  try {
    const session = await loadOpenSession(data.session_id);
    if (!session) return fail("not_found");
    if (session === "completed") return fail("not_found");
    if (session === "expired") return fail("checkout_expired");

    const [settings, user] = await Promise.all([getSiteSettings(), getCurrentUser()]);
    const method = (await checkoutPaymentMethods(settings)).find((item) => item.id === data.payment_method);
    if (!method) return fail("invalid_input");
    const country = data.shipping_address.country;
    if (!findShippingRateFor(settings, data.shipping_method, country)) return fail("shipping_unavailable");
    // The courier calls before delivering.
    if (method.type === "cash_on_delivery" && !data.shipping_address.phone) return fail("invalid_input");

    const checkout = getBackend().checkout;
    const locale = isLocale(session.locale) ? session.locale : settings.DEFAULT_LOCALE;

    // Re-price from the database: stock or prices may have changed since the session started.
    // A draft's invoice keeps the prices the staff agreed (stock is still checked by placeOrder).
    const draft = await draftForSession(session.id);
    const priced: PricedCart = draft
      ? { lines: session.line_items, removed: [], adjusted: [] }
      : await priceLines(
          session.line_items.map((line) => ({ variant_id: line.variant_id, quantity: line.quantity })),
          locale,
        );
    const discount = draft ? null : await findDiscount(data.discount_code);
    if (!draft && data.discount_code && !discount) return fail("invalid_discount");
    if (discount && (await isDiscountUsedBy(discount, data.email))) return fail("discount_already_used");
    const totals = draft
      ? draftTotals(
          priced.lines,
          { ...draft, shipping_method: data.shipping_method },
          settings,
          paymentFee(method),
          country,
        )
      : totalsFor(settings, priced.lines, data.shipping_method, method, discount, country);

    if (priced.removed.length > 0 || priced.adjusted.length > 0 || priced.lines.length === 0) {
      await checkout.updateSession(session.id, { line_items: priced.lines, ...totalsFields(totals) });
      return fail("out_of_stock");
    }
    if (totals.total !== data.expected_total) {
      await checkout.updateSession(session.id, { line_items: priced.lines, ...totalsFields(totals) });
      return fail("checkout_updated");
    }

    // The gift card pays first; what's left goes to the chosen payment method.
    const card = data.gift_card_code ? await findUsableGiftCard(data.gift_card_code, settings) : null;
    if (data.gift_card_code && !card) return fail("gift_card_unavailable");
    const gift = giftCardApplied(card, totals);
    const to_pay = totals.total - (gift?.amount ?? 0);

    const billing_address = data.is_billing_same ? data.shipping_address : data.billing_address;
    const ready: CheckoutSession = {
      ...session,
      // A draft's invoice belongs to the draft's customer, whoever opens the link.
      user: draft ? session.user : (user?.id ?? ""),
      email: data.email,
      locale,
      line_items: priced.lines,
      shipping_address: data.shipping_address,
      billing_address,
      shipping_method: data.shipping_method,
      payment_method: method.id,
      discount_code: discount?.id ?? "",
      customer_note: data.customer_note,
      gift_card_id: card?.id ?? "",
      gift_card_amount: gift?.amount ?? 0,
      ...totalsFields(totals),
    };
    const { id: _id, expires_at: _expires_at, status: _status, ...ready_patch } = ready;
    await checkout.updateSession(session.id, ready_patch);

    // Paid in full by the gift card: the order is paid now, whatever method was picked.
    if (to_pay === 0 && gift) {
      const placed = await placeSessionOrder({ ...ready, payment_method: "gift_card" }, settings, { status: "paid" });
      if (!placed) return fail("invalid_input");
      await sendOrderEmails("order_confirmation", placed.order_number);
      return ok({ kind: "order", order_number: placed.order_number });
    }

    if (method.type === "stripe") {
      const client_secret = await createStripeSession(ready, settings, locale);
      return client_secret ? ok({ kind: "stripe", client_secret }) : fail("payment_unavailable");
    }

    const placed = await placeSessionOrder(ready, settings, { status: "unpaid" });
    if (!placed) return fail("invalid_input");
    await sendOrderEmails("order_confirmation", placed.order_number);
    return ok({ kind: "order", order_number: placed.order_number });
  } catch (error) {
    return failFrom(error, "checkout", "completeCheckout");
  }
}

// A Stripe Checkout Session (Elements UI) charging exactly the server's total: one line per item,
// then shipping and excluded taxes, with the discount as a one-off coupon.
async function createStripeSession(session: CheckoutSession, settings: SiteSettings, locale: string) {
  const stripe = await getStripe();
  if (!stripe) return null;
  const currency = stripeCurrency(session.currency || settings.CURRENCY);
  const line = (name: string, unit_amount: number, quantity = 1): Stripe.Checkout.SessionCreateParams.LineItem => ({
    quantity,
    price_data: { currency, unit_amount, product_data: { name: name.slice(0, 250) } },
  });
  const text = (await getDictionary(locale)).checkout;
  const line_items = [
    ...session.line_items.map((item) =>
      line([item.title, item.variant_label].filter(Boolean).join(" · "), item.unit_price, item.quantity),
    ),
    ...(session.shipping_total > 0 ? [line(text.shipping, session.shipping_total)] : []),
    ...(!settings.TAX_INCLUDED && session.tax_total > 0 ? [line(text.taxes, session.tax_total)] : []),
  ];

  try {
    // The discount and the gift card come off together (Stripe has no negative lines).
    const amount_off = session.discount_total + session.gift_card_amount;
    const coupon =
      amount_off > 0
        ? await stripe.coupons.create({
            amount_off,
            currency,
            duration: "once",
            max_redemptions: 1,
          })
        : null;
    const metadata = { checkout_session: session.id };
    const created = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "payment",
      line_items,
      ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
      customer_email: session.email,
      return_url: `${SITE_URL}/${locale}/checkout/${session.id}/thank-you`,
      metadata,
      payment_intent_data: { metadata },
    });
    // Never charge a different amount than the one the customer saw.
    const to_pay = session.total - session.gift_card_amount;
    if (created.amount_total !== to_pay || !created.client_secret) {
      await stripe.checkout.sessions.expire(created.id).catch(() => undefined);
      await reportError("checkout", "stripe total mismatch", new Error(`${created.amount_total} != ${to_pay}`));
      return null;
    }
    return created.client_secret;
  } catch (error) {
    await reportError("checkout", "createStripeSession", error);
    return null;
  }
}

export type OrderConfirmation = {
  order_number: number;
  email: string;
  status: string;
  payment_status: "paid" | "unpaid";
  payment_method: CheckoutPaymentMethod | null;
  currency: string;
  lines: PricedLine[];
  totals: Totals;
  // Paid with a gift card; the customer still pays totals.total - gift_card_total.
  gift_card_total: number;
  shipping_address: AddressFields | null;
  shipping_method: string;
  is_guest: boolean;
};

// The thank-you page. "processing" = a card payment Stripe hasn't confirmed to us yet (the page
// checks again shortly). Authorized by possession of the session id.
export type CheckoutResult = { status: "completed"; order: OrderConfirmation } | { status: "processing" };

export async function getOrderConfirmation(session_id: string): Promise<ActionResult<CheckoutResult>> {
  if (!session_id_schema.safeParse(session_id).success) return fail("not_found");
  try {
    const checkout = getBackend().checkout;
    const session = await checkout.getSession(session_id);
    if (!session) return fail("not_found");
    if (session.status === "open") return ok({ status: "processing" });
    if (session.status !== "completed") return fail("not_found");
    const order = await checkout.orderForSession(session_id);
    if (!order) return ok({ status: "processing" });

    const settings = await getSiteSettings();
    const method = settings.PAYMENT_METHODS.find((item) => item.id === order.payment_method);

    return ok({
      status: "completed",
      order: {
        order_number: order.order_number,
        email: order.email,
        status: order.status,
        payment_status: order.status === "paid" ? "paid" : "unpaid",
        payment_method: method ? viewPaymentMethod(method, session.locale) : null,
        currency: order.currency,
        lines: session.line_items,
        totals: {
          subtotal: order.subtotal,
          discount_total: order.discount_total,
          shipping_total: order.shipping_total,
          is_free_shipping: order.shipping_total === 0,
          cod_fee: order.cod_fee,
          tax_total: order.tax_total,
          total: order.total,
        },
        gift_card_total: order.gift_card_total,
        shipping_address: order.shipping_address,
        shipping_method: order.shipping_method,
        is_guest: !order.user,
      },
    });
  } catch (error) {
    return failFrom(error, "checkout", "getOrderConfirmation");
  }
}

// The email field was filled in: save it, so a checkout left half-way can get a reminder.
export async function saveCheckoutContact(input: { session_id: string; email: string }): Promise<ActionResult<null>> {
  const parsed = z.object({ session_id: session_id_schema, email: email_schema }).safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const ip = await getClientIp();
  if (isRateLimited(`checkout_contact:${ip}`, 30, 10 * 60_000)) return fail("rate_limited");
  try {
    await getBackend().abandoned_checkouts.saveContact(parsed.data.session_id, parsed.data.email);
    return ok(null);
  } catch (error) {
    return failFrom(error, "checkout", "saveCheckoutContact");
  }
}

// The visitor's "utm" cookie, plus (only with marketing consent) what the server Purchase event
// needs, since the Stripe webhook that places card orders has no browser of its own.
async function requestAttribution(): Promise<Attribution | null> {
  const [cookie_store, header_store] = await Promise.all([cookies(), headers()]);
  const attribution: Attribution = parseAttribution(cookie_store.get(TRACKING_COOKIE)?.value ?? "");
  if (parseConsent(cookie_store.get(CONSENT_COOKIE)?.value)?.marketing) {
    attribution.consent_marketing = "1";
    attribution.client_ip = await getClientIp();
    attribution.user_agent = (header_store.get("user-agent") ?? "").slice(0, 500);
    const fbp = cookie_store.get(FBP_COOKIE)?.value;
    const fbc = cookie_store.get(FBC_COOKIE)?.value;
    if (fbp) attribution.fbp = fbp.slice(0, 200);
    if (fbc) attribution.fbc = fbc.slice(0, 200);
  }
  return Object.keys(attribution).length > 0 ? attribution : null;
}

// The part of the total a gift card pays (all of it when its balance is enough).
function giftCardApplied(card: GiftCard | null, totals: Totals): AppliedGiftCard | null {
  if (!card) return null;
  const amount = Math.min(card.balance, totals.total);
  return amount > 0 ? { code: card.code, masked: maskGiftCardCode(card.code), amount, balance: card.balance } : null;
}
