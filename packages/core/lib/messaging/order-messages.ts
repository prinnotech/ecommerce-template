import "server-only";

import { after } from "next/server";

import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, MessageChannel } from "@repo/core/backend/types";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { orderLocale, placeholderValues } from "@repo/core/lib/email/order-values";
import { fillPlaceholders, type Placeholder } from "@repo/core/lib/email/templates";
import { localized } from "@repo/core/lib/localized";
import { sendMessage } from "@repo/core/lib/messaging/twilio";
import {
  isMessageEvent,
  isTwilioConfigured,
  messageEventSettings,
  STAFF_MESSAGE_EVENTS,
  type MessageEvent,
  type MessageEventSettings,
  type MessagePlaceholder,
  type MessagingSettings,
} from "@repo/core/lib/schemas/messaging";
import { reportError } from "@repo/core/lib/server-log";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// SMS and WhatsApp messages for order events (Settings → SMS & WhatsApp). Customers get them only
// if they ticked "Send me order updates" at checkout; staff alerts go to the staff numbers.

type Values = Partial<Record<MessagePlaceholder, string>>;

function staffLocale(settings: SiteSettings): Locale {
  return isLocale(settings.DEFAULT_LOCALE) ? settings.DEFAULT_LOCALE : LOCALES[0];
}

// The channels switched on for an event that have a sender set up.
function channelsFor(config: MessageEventSettings, settings: MessagingSettings): MessageChannel[] {
  const channels: MessageChannel[] = [];
  if (config.sms && settings.sms_from) channels.push("sms");
  if (config.whatsapp && settings.whatsapp_from && config.whatsapp_content_sid) channels.push("whatsapp");
  return channels;
}

async function sendEvent(
  event: MessageEvent,
  recipients: string[],
  values: Values,
  locale: Locale,
  settings: MessagingSettings,
  order_id: string,
): Promise<void> {
  const config = messageEventSettings(settings, event);
  const channels = channelsFor(config, settings);
  if (channels.length === 0 || recipients.length === 0) return;
  const body = fillPlaceholders<MessagePlaceholder>(localized(config.sms_text, locale), values);
  for (const to of recipients) {
    for (const channel of channels) {
      await sendMessage(
        channel === "sms"
          ? { channel, to, event, body, order_id }
          : {
              channel,
              to,
              event,
              content_sid: config.whatsapp_content_sid,
              // Twilio rejects empty variables: a missing value becomes a dash.
              content_variables: config.whatsapp_variables.map((name) => values[name] || "-"),
              order_id,
            },
        settings,
      );
    }
  }
}

// The messages for an order event (called by sendOrderEmails, after the response). A new order
// also alerts the staff.
export async function sendOrderMessages(
  event: string,
  order: AdminOrderDetail,
  extra: Partial<Record<Placeholder, string>> = {},
): Promise<void> {
  const settings = await getSiteSettings();
  const messaging = settings.MESSAGING;
  if (!isTwilioConfigured(messaging)) return;
  const events: MessageEvent[] = [];
  if (isMessageEvent(event)) events.push(event);
  if (event === "order_confirmation") events.push("staff_new_order");

  for (const item of events) {
    const is_staff = STAFF_MESSAGE_EVENTS.includes(item);
    const locale = is_staff ? staffLocale(settings) : orderLocale(order, settings);
    const recipients = is_staff ? messaging.staff_phones : order.sms_opt_in && order.phone ? [order.phone] : [];
    const values: Values = placeholderValues(order, settings, locale, extra, is_staff);
    await sendEvent(item, recipients, values, locale, messaging, order.id);
  }
}

// After an order: a staff alert for each variant whose stock just went down to the low-stock
// threshold or below (not for every later order while it stays low).
export function notifyLowStock(lines: { variant_id: string; quantity: number }[]): void {
  const sold = new Map<string, number>();
  for (const line of lines) {
    if (line.variant_id) sold.set(line.variant_id, (sold.get(line.variant_id) ?? 0) + line.quantity);
  }
  if (sold.size === 0) return;
  after(async () => {
    try {
      const settings = await getSiteSettings();
      const messaging = settings.MESSAGING;
      if (!isTwilioConfigured(messaging) || messaging.staff_phones.length === 0) return;
      if (channelsFor(messageEventSettings(messaging, "staff_low_stock"), messaging).length === 0) return;
      const threshold = settings.LOW_STOCK_THRESHOLD;
      const locale = staffLocale(settings);
      const variants = await getBackend().checkout.pricingVariants([...sold.keys()]);
      for (const variant of variants) {
        const quantity = sold.get(variant.variant_id) ?? 0;
        if (variant.stock > threshold || variant.stock + quantity <= threshold) continue;
        const label = [variant.size, variant.color].filter(Boolean).join(" / ");
        const title = localized(variant.title, locale);
        await sendEvent(
          "staff_low_stock",
          messaging.staff_phones,
          {
            store_name: settings.SITE_NAME,
            product_name: label ? `${title} (${label})` : title,
            stock_left: String(variant.stock),
          },
          locale,
          messaging,
          "",
        );
      }
    } catch (error) {
      await reportError("messaging", "low stock alerts", error);
    }
  });
}
