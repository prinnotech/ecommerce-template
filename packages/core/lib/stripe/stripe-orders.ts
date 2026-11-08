import "server-only";

import type Stripe from "stripe";

import { BackendError } from "@repo/core/backend/errors";
import { getBackend } from "@repo/core/backend/index";
import { placeSessionOrder } from "@repo/core/lib/checkout/place-order";
import { sendOrderEmails } from "@repo/core/lib/email/order-emails";
import { reportError } from "@repo/core/lib/server-log";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getStripe } from "@repo/core/lib/stripe/stripe-server";

// What the Stripe webhook does with a Checkout Session. The webhook is the source of truth for
// card payments: the browser's redirect is never trusted. Safe to receive twice (Stripe retries):
// a session that already became an order is skipped.
export async function handlePaidCheckoutSession(stripe_session: Stripe.Checkout.Session): Promise<"done" | "retry"> {
  if (stripe_session.payment_status !== "paid") return "done";
  const session_id = stripe_session.metadata?.checkout_session;
  if (!session_id) return "done";

  const checkout = getBackend().checkout;
  const session = await checkout.getSession(session_id);
  if (!session || session.status !== "open") return "done";

  const payment_intent =
    typeof stripe_session.payment_intent === "string"
      ? stripe_session.payment_intent
      : (stripe_session.payment_intent?.id ?? "");
  try {
    const settings = await getSiteSettings();
    const placed = await placeSessionOrder(session, settings, { status: "paid", provider_ref: payment_intent });
    if (placed) await sendOrderEmails("order_confirmation", placed.order_number);
    return "done";
  } catch (error) {
    if (error instanceof BackendError && (error.code === "out_of_stock" || error.code === "gift_card_unavailable")) {
      // Paid, but the last units sold in the meantime: give the money back right away.
      await refundUnplacedPayment(payment_intent, session_id);
      return "done";
    }
    await reportError("stripe", "place paid order", error);
    return "retry";
  }
}

async function refundUnplacedPayment(payment_intent: string, session_id: string): Promise<void> {
  try {
    const stripe = await getStripe();
    if (stripe && payment_intent) await stripe.refunds.create({ payment_intent, reason: "requested_by_customer" });
    await getBackend().checkout.updateSession(session_id, { status: "failed" });
    await reportError("stripe", "out of stock after payment: refunded", new Error(session_id));
  } catch (error) {
    await reportError("stripe", "refund after out of stock", error);
  }
}

// Admin refunds of card orders go back to the card.
export async function refundStripePayment(payment_intent: string, amount: number): Promise<boolean> {
  const stripe = await getStripe();
  if (!stripe || !payment_intent) return false;
  await stripe.refunds.create({ payment_intent, amount });
  return true;
}
