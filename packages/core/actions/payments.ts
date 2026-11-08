"use server";

import Stripe from "stripe";
import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { payment_methods_schema, type PaymentMethodConfig } from "@repo/core/lib/schemas/payments";
import { canStoreSecrets, saveSecret, secretStatus, type SecretStatus } from "@repo/core/lib/secrets";
import { SITE_URL } from "@repo/core/lib/site-config";
import { SITE_SETTINGS } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { revalidateStore } from "@repo/core/lib/store-revalidate";

// Settings → Payments: the payment methods list and the Stripe connection.

export type PaymentsOverview = {
  methods: PaymentMethodConfig[];
  stripe: {
    publishable_key: string;
    secret_key: SecretStatus;
    webhook_secret: SecretStatus;
    // Paste in Stripe → Developers → Webhooks.
    webhook_url: string;
    is_ready: boolean;
  };
  // SETTINGS_ENCRYPTION_KEY is set, so secrets can be saved here.
  can_store_secrets: boolean;
};

export async function getPaymentsOverview(): Promise<ActionResult<PaymentsOverview>> {
  const auth = await authorize("settings.view", "view payment settings");
  if (!auth.ok) return auth;
  try {
    const [settings, secrets] = await Promise.all([getSiteSettings(), secretStatus()]);
    return ok({
      methods: settings.PAYMENT_METHODS,
      stripe: {
        publishable_key: settings.STRIPE_PUBLISHABLE_KEY,
        secret_key: secrets.STRIPE_SECRET_KEY,
        webhook_secret: secrets.STRIPE_WEBHOOK_SECRET,
        webhook_url: `${SITE_URL}/api/stripe/webhook`,
        is_ready:
          Boolean(settings.STRIPE_PUBLISHABLE_KEY) &&
          secrets.STRIPE_SECRET_KEY.is_set &&
          secrets.STRIPE_WEBHOOK_SECRET.is_set,
      },
      can_store_secrets: canStoreSecrets(),
    });
  } catch (error) {
    return failFrom(error, "payments", "getPaymentsOverview");
  }
}

// The whole list at once (order, on/off, names, instructions, fees).
export async function savePaymentMethods(input: PaymentMethodConfig[]): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "edit payment methods");
  if (!auth.ok) return auth;
  const parsed = payment_methods_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const definition = SITE_SETTINGS.PAYMENT_METHODS;
    await getBackend().settings.save({
      key: "PAYMENT_METHODS",
      category: definition.category,
      value: parsed.data,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit payment methods",
      target_type: "settings",
      details: { enabled: parsed.data.filter((method) => method.is_enabled).map((method) => method.id) },
    });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "payments", "savePaymentMethods");
  }
}

const stripe_keys_schema = z.object({
  publishable_key: z.union([
    z
      .string()
      .trim()
      .regex(/^pk_(test|live)_[A-Za-z0-9]+$/, "invalid"),
    z.literal(""),
  ]),
  // undefined = keep the saved one; "" = remove it.
  secret_key: z
    .union([
      z
        .string()
        .trim()
        .regex(/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/, "invalid"),
      z.literal(""),
    ])
    .optional(),
  webhook_secret: z
    .union([
      z
        .string()
        .trim()
        .regex(/^whsec_[A-Za-z0-9]+$/, "invalid"),
      z.literal(""),
    ])
    .optional(),
});
export type StripeKeysInput = z.input<typeof stripe_keys_schema>;

export async function saveStripeKeys(input: StripeKeysInput): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "change the Stripe keys");
  if (!auth.ok) return auth;
  const parsed = stripe_keys_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { publishable_key, secret_key, webhook_secret } = parsed.data;
  if ((secret_key || webhook_secret) && !canStoreSecrets()) return fail("secrets_unavailable");
  // Test and live keys can't be mixed.
  if (secret_key && publishable_key && secret_key.includes("_live_") !== publishable_key.includes("_live_")) {
    return fail("stripe_key_mismatch");
  }

  try {
    if (secret_key) {
      // A quick call proves the key works before it's saved.
      const is_valid = await new Stripe(secret_key, { apiVersion: "2026-10-28.endive" }).balance
        .retrieve()
        .then(() => true)
        .catch(() => false);
      if (!is_valid) return fail("stripe_key_invalid");
    }
    const definition = SITE_SETTINGS.STRIPE_PUBLISHABLE_KEY;
    await getBackend().settings.save({
      key: "STRIPE_PUBLISHABLE_KEY",
      category: definition.category,
      value: publishable_key,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    if (secret_key !== undefined) await saveSecret("STRIPE_SECRET_KEY", secret_key, auth.caller.user_id);
    if (webhook_secret !== undefined) await saveSecret("STRIPE_WEBHOOK_SECRET", webhook_secret, auth.caller.user_id);
    // Only which keys changed, never their values.
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the Stripe keys",
      target_type: "settings",
      details: { secret_key: secret_key !== undefined, webhook_secret: webhook_secret !== undefined },
    });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "payments", "saveStripeKeys");
  }
}
