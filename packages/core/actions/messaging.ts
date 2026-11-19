"use server";

import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { MessageLogEntry, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { sendMessage } from "@repo/core/lib/messaging/twilio";
import { isTwilioConfigured, messaging_schema, type MessagingSettings } from "@repo/core/lib/schemas/messaging";
import { canStoreSecrets, saveSecret, secretStatus, type SecretStatus } from "@repo/core/lib/secrets";
import { SITE_SETTINGS } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// Settings → SMS & WhatsApp (Twilio), its message log, and the messages on an order's timeline.

export type MessagingOverview = {
  settings: MessagingSettings;
  auth_token: SecretStatus;
  can_store_secrets: boolean;
  is_configured: boolean;
};

export async function getMessaging(): Promise<ActionResult<MessagingOverview>> {
  const auth = await authorize("settings.view", "view the SMS and WhatsApp settings");
  if (!auth.ok) return auth;
  try {
    const [settings, secrets] = await Promise.all([getSiteSettings(), secretStatus()]);
    return ok({
      settings: settings.MESSAGING,
      auth_token: secrets.TWILIO_AUTH_TOKEN,
      can_store_secrets: canStoreSecrets(),
      is_configured: isTwilioConfigured(settings.MESSAGING) && secrets.TWILIO_AUTH_TOKEN.is_set,
    });
  } catch (error) {
    return failFrom(error, "messaging", "getMessaging");
  }
}

const save_messaging_schema = z.object({
  settings: messaging_schema,
  // undefined = keep the saved token; "" = remove it.
  auth_token: z.string().trim().max(200).optional(),
});
export type SaveMessagingInput = z.input<typeof save_messaging_schema>;

export async function saveMessaging(input: SaveMessagingInput): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "change the SMS and WhatsApp settings");
  if (!auth.ok) return auth;
  const parsed = save_messaging_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  if (parsed.data.auth_token && !canStoreSecrets()) return fail("secrets_unavailable");

  try {
    const definition = SITE_SETTINGS.MESSAGING;
    await getBackend().settings.save({
      key: "MESSAGING",
      category: definition.category,
      value: parsed.data.settings,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    if (parsed.data.auth_token !== undefined)
      await saveSecret("TWILIO_AUTH_TOKEN", parsed.data.auth_token, auth.caller.user_id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the SMS and WhatsApp settings",
      target_type: "settings",
      details: {
        account_sid: parsed.data.settings.account_sid,
        auth_token_changed: parsed.data.auth_token !== undefined,
      },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "messaging", "saveMessaging");
  }
}

// A short message with the SAVED settings, so what's tested is what orders will use. A WhatsApp
// test is plain text: Twilio only delivers it inside a 24-hour window the recipient opened (the
// sandbox's "join" message counts), since outside it only approved templates go through.
export async function sendMessagingTest(input: {
  channel: "sms" | "whatsapp";
  to: string;
}): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "send a test SMS or WhatsApp message");
  if (!auth.ok) return auth;
  const parsed = z
    .object({ channel: z.enum(["sms", "whatsapp"]), to: z.string().trim().min(6).max(40) })
    .safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const settings = await getSiteSettings();
    const result = await sendMessage(
      {
        channel: parsed.data.channel,
        to: parsed.data.to,
        event: "test",
        body: `${settings.SITE_NAME}: ${parsed.data.channel === "sms" ? "SMS" : "WhatsApp"} ✓`,
      },
      settings.MESSAGING,
    );
    if (result.ok) return ok(null);
    if (result.error === "not_configured") return fail("messaging_not_configured");
    if (result.error === "invalid_phone") return fail("invalid_phone");
    return fail("messaging_failed");
  } catch (error) {
    return failFrom(error, "messaging", "sendMessagingTest");
  }
}

const PAGE_SIZE = 20;

export async function getMessageLog(input: { page: number }): Promise<ActionResult<Page<MessageLogEntry>>> {
  const auth = await authorize("settings.view", "view the message log");
  if (!auth.ok) return auth;
  const parsed = z.object({ page: z.number().int().min(1).max(10_000) }).safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    return ok(await getBackend().message_log.list(parsed.data.page, PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "messaging", "getMessageLog");
  }
}

// The SMS and WhatsApp messages of one order, for its timeline.
export async function getOrderMessages(input: { order_id: string }): Promise<ActionResult<MessageLogEntry[]>> {
  const auth = await authorize("orders.view", "view an order's messages");
  if (!auth.ok) return auth;
  const parsed = z.object({ order_id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    return ok(await getBackend().message_log.listForOrder(parsed.data.order_id));
  } catch (error) {
    return failFrom(error, "messaging", "getOrderMessages");
  }
}
