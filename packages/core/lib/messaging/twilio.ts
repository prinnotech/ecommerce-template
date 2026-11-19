import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { MessageChannel } from "@repo/core/backend/types";
import { isTwilioConfigured, toE164, type MessagingSettings } from "@repo/core/lib/schemas/messaging";
import { getSecret } from "@repo/core/lib/secrets";
import { reportError } from "@repo/core/lib/server-log";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// Sends one SMS or WhatsApp message through Twilio's REST API (plain fetch, no SDK) and records
// it in the message log. Never throws: a messaging problem must not break an order.

export type OutgoingMessage = {
  channel: MessageChannel;
  // As typed by the customer or staff; turned into E.164 here.
  to: string;
  event: string;
  // SMS (and WhatsApp replies): the text. WhatsApp messages the store starts use a Content
  // template instead, with its variables in order.
  body?: string;
  content_sid?: string;
  content_variables?: string[];
  order_id?: string;
};

export type MessageResult = { ok: true; sid: string } | { ok: false; error: string };

const TIMEOUT_MS = 15_000;

type TwilioResponse = { sid?: string; message?: string; code?: number };

async function callTwilio(
  message: OutgoingMessage & { to: string },
  settings: MessagingSettings,
  token: string,
): Promise<MessageResult> {
  const form = new URLSearchParams();
  if (message.channel === "whatsapp") {
    form.set("To", `whatsapp:${message.to}`);
    form.set("From", `whatsapp:${settings.whatsapp_from}`);
  } else {
    form.set("To", message.to);
    if (settings.sms_from.startsWith("MG")) form.set("MessagingServiceSid", settings.sms_from);
    else form.set("From", settings.sms_from);
  }
  if (message.content_sid) {
    form.set("ContentSid", message.content_sid);
    const variables = Object.fromEntries((message.content_variables ?? []).map((value, index) => [index + 1, value]));
    form.set("ContentVariables", JSON.stringify(variables));
  } else {
    form.set("Body", message.body ?? "");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(settings.account_sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.account_sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const data = (await response.json().catch(() => ({}))) as TwilioResponse;
  if (response.ok && data.sid) return { ok: true, sid: data.sid };
  const reason = data.message ?? `HTTP ${response.status}`;
  return { ok: false, error: (data.code ? `${data.code}: ${reason}` : reason).slice(0, 500) };
}

export async function sendMessage(message: OutgoingMessage, settings?: MessagingSettings): Promise<MessageResult> {
  const [config, token] = await Promise.all([
    settings ? Promise.resolve(settings) : getSiteSetting("MESSAGING"),
    getSecret("TWILIO_AUTH_TOKEN"),
  ]);
  const log = getBackend().message_log;
  const to = toE164(message.to, config.default_country_code);
  const base = {
    channel: message.channel,
    event: message.event,
    recipient: (to ?? message.to).slice(0, 40),
    body: (message.body ?? (message.content_variables ?? []).join(" · ")).slice(0, 2000),
    order_id: message.order_id ?? "",
  };
  const skip = async (error: string): Promise<MessageResult> => {
    await log.log({ ...base, status: "skipped", error, provider_ref: "" }).catch(() => undefined);
    return { ok: false, error };
  };

  const sender = message.channel === "whatsapp" ? config.whatsapp_from : config.sms_from;
  if (!isTwilioConfigured(config) || !sender || !token) return skip("not_configured");
  if (!to) return skip("invalid_phone");
  if (message.channel === "whatsapp" && !message.content_sid && !message.body) return skip("no_template");

  try {
    const result = await callTwilio({ ...message, to }, config, token);
    await log
      .log({
        ...base,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? "" : result.error,
        provider_ref: result.ok ? result.sid : "",
      })
      .catch(() => undefined);
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 500) : "unknown error";
    await reportError("messaging", `send ${message.channel} ${message.event}`, error);
    await log.log({ ...base, status: "failed", error: reason, provider_ref: "" }).catch(() => undefined);
    return { ok: false, error: reason };
  }
}
