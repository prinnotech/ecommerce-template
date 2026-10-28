"use server";

import { z } from "zod";

import { getMyAddresses, type Address } from "@/app/actions/account";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import {
  CHECKOUT_TTL_MS,
  enabledPaymentMethods,
  findDiscount,
  findShippingRate,
  newRecordId,
  priceLines,
  type FoundDiscount,
  type PricedLine,
} from "@/lib/checkout/checkout-server";
import { computeTotals, type Totals } from "@/lib/checkout/pricing";
import { isLocale } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import type { AddressFields } from "@/lib/schemas/account";
import {
  complete_checkout_schema,
  create_checkout_schema,
  quote_checkout_schema,
  type CompleteCheckoutInput,
  type CreateCheckoutInput,
  type PaymentMethod,
  type QuoteCheckoutInput,
} from "@/lib/schemas/checkout";
import { reportError } from "@/lib/server-log";
import type { SiteSettings } from "@/lib/site-settings";
import { getSiteSettings } from "@/lib/site-settings-server";
import type { CheckoutSessionsResponse } from "@/types/pocketbase-types";

// Checkout sessions are locked in PocketBase (admin client only). Possessing the session id
// (15 random characters, only ever given to the browser that created it) is what authorizes
// access to that one session, like a Stripe Checkout Session URL.

type SessionRecord = CheckoutSessionsResponse<unknown, AddressFields | null, PricedLine[], AddressFields | null>;

const session_id_schema = z.string().regex(/^[a-z0-9]{15}$/);

export type CheckoutShippingRate = { id: string; name: string; price: number; min_days: number; max_days: number };

export type CheckoutView = {
  id: string;
  locale: string;
  currency: string;
  email: string;
  lines: PricedLine[];
  totals: Totals;
  shipping_method: string;
  payment_method: PaymentMethod;
  discount_code: string;
  shipping_rates: CheckoutShippingRate[];
  payment_methods: PaymentMethod[];
  free_shipping_threshold: number;
  tax_included: boolean;
  tax_rate: number;
  cod_fee: number;
  user: { email: string; name: string } | null;
  saved_addresses: Address[];
  expires_at: string;
};

export type CheckoutState = { status: "open"; checkout: CheckoutView } | { status: "completed" };

function totalsFor(
  settings: SiteSettings,
  lines: PricedLine[],
  shipping_method: string,
  payment_method: PaymentMethod,
  discount: FoundDiscount | null,
): Totals {
  return computeTotals({
    lines,
    shipping_price: findShippingRate(settings, shipping_method)?.price ?? null,
    free_shipping_threshold: settings.FREE_SHIPPING_THRESHOLD,
    discount: discount?.discount ?? null,
    tax_rate: settings.TAX_RATE,
    tax_included: settings.TAX_INCLUDED,
    cod_fee: settings.COD_FEE,
    is_cash_on_delivery: payment_method === "cash_on_delivery",
  });
}

function totalsFields(totals: Totals) {
  return {
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    shipping_total: totals.shipping_total,
    tax_total: totals.tax_total,
    cod_fee: totals.cod_fee,
    total: totals.total,
  };
}

async function loadOpenSession(id: string): Promise<SessionRecord | "expired" | "completed" | null> {
  if (!session_id_schema.safeParse(id).success) return null;
  const pb = await createAdminPocketBase();
  const session = await pb
    .collection("checkout_sessions")
    .getOne<SessionRecord>(id)
    .catch(() => null);
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

    const payment_methods = enabledPaymentMethods(settings);
    const payment_method = payment_methods[0] ?? "cash_on_delivery";
    const shipping_method = settings.SHIPPING_RATES[0]?.id ?? "";
    const totals = totalsFor(settings, priced.lines, shipping_method, payment_method, null);

    const pb = await createAdminPocketBase();
    const session = await pb.collection("checkout_sessions").create({
      user: user?.id ?? "",
      email: user?.email ?? "",
      locale: parsed.data.locale,
      line_items: priced.lines,
      ...totalsFields(totals),
      currency: settings.CURRENCY,
      shipping_method,
      payment_method,
      status: "open",
      expires_at: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
    });
    return ok({ id: session.id });
  } catch (error) {
    await reportError("checkout", "createCheckoutSession", error);
    return fail("generic");
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
    const discount = session.discount_code
      ? await (
          await createAdminPocketBase()
        )
          .collection("discount_codes")
          .getOne(session.discount_code, { fields: "code" })
          .catch(() => null)
      : null;
    const addresses = user ? await getMyAddresses() : null;

    return ok({
      status: "open",
      checkout: {
        id: session.id,
        locale,
        currency: session.currency || settings.CURRENCY,
        email: session.email || user?.email || "",
        lines: session.line_items ?? [],
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
        shipping_method: session.shipping_method,
        payment_method: session.payment_method || "cash_on_delivery",
        discount_code: discount?.code ?? "",
        shipping_rates: settings.SHIPPING_RATES.map((rate) => ({
          id: rate.id,
          name: localized(rate.name, locale) || rate.id,
          price: rate.price,
          min_days: rate.min_days,
          max_days: rate.max_days,
        })),
        payment_methods: enabledPaymentMethods(settings),
        free_shipping_threshold: settings.FREE_SHIPPING_THRESHOLD,
        tax_included: settings.TAX_INCLUDED,
        tax_rate: settings.TAX_RATE,
        cod_fee: settings.COD_FEE,
        user: user ? { email: user.email, name: user.name } : null,
        saved_addresses: addresses?.ok ? addresses.data : [],
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    await reportError("checkout", "getCheckout", error);
    return fail("generic");
  }
}

export type CheckoutQuote = { totals: Totals; discount_code: string; is_discount_invalid: boolean };

// Recomputes totals when the shipping method, payment method or discount code changes.
export async function quoteCheckout(input: QuoteCheckoutInput): Promise<ActionResult<CheckoutQuote>> {
  const parsed = quote_checkout_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { session_id, shipping_method, payment_method, discount_code } = parsed.data;

  try {
    const session = await loadOpenSession(session_id);
    if (!session || session === "completed") return fail("not_found");
    if (session === "expired") return fail("checkout_expired");

    const settings = await getSiteSettings();
    if (!enabledPaymentMethods(settings).includes(payment_method)) return fail("invalid_input");
    if (!findShippingRate(settings, shipping_method)) return fail("invalid_input");

    const discount = await findDiscount(discount_code);
    const totals = totalsFor(settings, session.line_items ?? [], shipping_method, payment_method, discount);

    const pb = await createAdminPocketBase();
    await pb.collection("checkout_sessions").update(session_id, {
      shipping_method,
      payment_method,
      discount_code: discount?.id ?? "",
      ...totalsFields(totals),
    });
    return ok({
      totals,
      discount_code: discount?.code ?? "",
      is_discount_invalid: Boolean(discount_code) && !discount,
    });
  } catch (error) {
    await reportError("checkout", "quoteCheckout", error);
    return fail("generic");
  }
}

export async function completeCheckout(input: CompleteCheckoutInput): Promise<ActionResult<{ order_number: number }>> {
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
    if (!enabledPaymentMethods(settings).includes(data.payment_method)) return fail("invalid_input");
    if (!findShippingRate(settings, data.shipping_method)) return fail("invalid_input");

    const pb = await createAdminPocketBase();
    const locale = isLocale(session.locale) ? session.locale : settings.DEFAULT_LOCALE;

    // Re-price from the database: stock or prices may have changed since the session started.
    const snapshot = session.line_items ?? [];
    const priced = await priceLines(
      snapshot.map((line) => ({ variant_id: line.variant_id, quantity: line.quantity })),
      locale,
    );
    const discount = await findDiscount(data.discount_code);
    if (data.discount_code && !discount) return fail("invalid_discount");
    const totals = totalsFor(settings, priced.lines, data.shipping_method, data.payment_method, discount);

    if (priced.removed.length > 0 || priced.adjusted.length > 0 || priced.lines.length === 0) {
      await pb
        .collection("checkout_sessions")
        .update(session.id, { line_items: priced.lines, ...totalsFields(totals) });
      return fail("out_of_stock");
    }
    if (totals.total !== data.expected_total) {
      await pb
        .collection("checkout_sessions")
        .update(session.id, { line_items: priced.lines, ...totalsFields(totals) });
      return fail("checkout_updated");
    }

    const billing_address = data.is_billing_same ? data.shipping_address : data.billing_address;
    const rate = findShippingRate(settings, data.shipping_method);
    const shipping_label = rate ? localized(rate.name, locale) || rate.id : data.shipping_method;

    // The card form is a placeholder until a real provider (Stripe) is connected: it always
    // declines. Card details never reach the server; only the attempt is recorded.
    if (data.payment_method === "card") {
      await pb.collection("checkout_sessions").update(session.id, {
        email: data.email,
        shipping_address: data.shipping_address,
        billing_address,
        shipping_method: data.shipping_method,
        payment_method: "card",
        discount_code: discount?.id ?? "",
        ...totalsFields(totals),
      });
      await pb.collection("payments").create({
        checkout_session: session.id,
        provider: "card",
        amount: totals.total,
        currency: settings.CURRENCY,
        status: "failed",
        error_code: "card_declined",
      });
      return fail("card_declined");
    }

    // Cash on delivery: everything in one atomic batch. A stock decrement below zero fails the
    // stock field's min: 0 rule, which rolls the whole batch back.
    const order_id = newRecordId();
    const batch = pb.createBatch();
    batch.collection("orders").create({
      id: order_id,
      user: user?.id ?? "",
      email: data.email,
      phone: data.shipping_address.phone,
      locale,
      status: "pending",
      payment_status: "unpaid",
      payment_method: "cash_on_delivery",
      currency: settings.CURRENCY,
      ...totalsFields(totals),
      discount_code: discount?.id ?? "",
      shipping_address: data.shipping_address,
      billing_address,
      shipping_method: shipping_label,
      customer_note: data.customer_note,
      checkout_session: session.id,
    });
    for (const line of priced.lines) {
      batch.collection("order_items").create({
        order: order_id,
        product: line.product_id,
        variant: line.variant_id,
        title: line.title,
        variant_label: line.variant_label,
        sku: line.sku,
        image: line.image,
        unit_price: line.unit_price,
        quantity: line.quantity,
        line_total: line.line_total,
      });
      batch.collection("product_variants").update(line.variant_id, { "stock-": line.quantity });
    }
    batch.collection("order_events").create({ order: order_id, type: "created", is_customer_visible: true });
    batch.collection("payments").create({
      order: order_id,
      checkout_session: session.id,
      provider: "cash_on_delivery",
      amount: totals.total,
      currency: settings.CURRENCY,
      status: "pending",
    });
    if (discount) batch.collection("discount_codes").update(discount.id, { "used_count+": 1 });
    batch.collection("checkout_sessions").update(session.id, {
      status: "completed",
      email: data.email,
      user: user?.id ?? "",
      line_items: priced.lines,
      shipping_address: data.shipping_address,
      billing_address,
      shipping_method: data.shipping_method,
      payment_method: "cash_on_delivery",
      discount_code: discount?.id ?? "",
      ...totalsFields(totals),
    });

    try {
      await batch.send();
    } catch (error) {
      // Most likely someone bought the last units between the stock check and the batch.
      await reportError("checkout", "completeCheckout batch", error);
      return fail("out_of_stock");
    }

    const order = await pb.collection("orders").getOne(order_id, { fields: "order_number" });
    return ok({ order_number: order.order_number });
  } catch (error) {
    await reportError("checkout", "completeCheckout", error);
    return fail("generic");
  }
}

export type OrderConfirmation = {
  order_number: number;
  email: string;
  status: string;
  payment_method: string;
  currency: string;
  lines: PricedLine[];
  totals: Totals;
  shipping_address: AddressFields | null;
  shipping_method: string;
  is_guest: boolean;
};

// Thank-you page data, authorized by possession of the (completed) session id.
export async function getOrderConfirmation(session_id: string): Promise<ActionResult<OrderConfirmation>> {
  if (!session_id_schema.safeParse(session_id).success) return fail("not_found");
  try {
    const pb = await createAdminPocketBase();
    const session = await pb
      .collection("checkout_sessions")
      .getOne<SessionRecord>(session_id)
      .catch(() => null);
    if (!session || session.status !== "completed") return fail("not_found");

    const order = await pb
      .collection("orders")
      .getFirstListItem(pb.filter("checkout_session = {:id}", { id: session_id }))
      .catch(() => null);
    if (!order) return fail("not_found");

    return ok({
      order_number: order.order_number,
      email: order.email,
      status: order.status,
      payment_method: order.payment_method,
      currency: order.currency,
      lines: session.line_items ?? [],
      totals: {
        subtotal: order.subtotal,
        discount_total: order.discount_total,
        shipping_total: order.shipping_total,
        is_free_shipping: order.shipping_total === 0,
        cod_fee: order.cod_fee,
        tax_total: order.tax_total,
        total: order.total,
      },
      shipping_address: (order.shipping_address as AddressFields | null) ?? null,
      shipping_method: order.shipping_method,
      is_guest: !order.user,
    });
  } catch (error) {
    await reportError("checkout", "getOrderConfirmation", error);
    return fail("generic");
  }
}
