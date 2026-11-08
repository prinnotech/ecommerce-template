import "server-only";

import Stripe from "stripe";

import { getSecret } from "@repo/core/lib/secrets";
import type { SiteSettings } from "@repo/core/lib/site-settings";

// Stripe, with the secret key from Settings → Payments (encrypted) or the STRIPE_SECRET_KEY env.
// A client per call, since the owner can change the key at any time. The API version is pinned
// so upgrades are deliberate (it's the one the installed SDK is typed for).
export async function getStripe(): Promise<Stripe | null> {
  const key = await getSecret("STRIPE_SECRET_KEY");
  return key ? new Stripe(key, { apiVersion: "2026-10-28.endive" }) : null;
}

// Card payments need both keys: the publishable one for the card form, the secret one here.
export async function isStripeReady(settings: SiteSettings): Promise<boolean> {
  return Boolean(settings.STRIPE_PUBLISHABLE_KEY) && Boolean(await getSecret("STRIPE_SECRET_KEY"));
}

// Stripe amounts are in the currency's smallest unit, like ours (cents), for 2-decimal currencies.
export function stripeCurrency(currency: string): string {
  return currency.toLowerCase();
}
