import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { getSecret } from "@repo/core/lib/secrets";
import { getStripe } from "@repo/core/lib/stripe/stripe-server";
import { handlePaidCheckoutSession } from "@repo/core/lib/stripe/stripe-orders";

// Stripe → us (Settings → Payments shows this address to paste in Stripe's dashboard). The
// signature is checked with the webhook signing secret before anything else.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const [stripe, secret] = await Promise.all([getStripe(), getSecret("STRIPE_WEBHOOK_SECRET")]);
  if (!signature || !secret || !stripe) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    // "retry" = a temporary problem on our side: a 500 makes Stripe send the event again.
    if ((await handlePaidCheckoutSession(event.data.object)) === "retry") {
      return NextResponse.json({ error: "generic" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
