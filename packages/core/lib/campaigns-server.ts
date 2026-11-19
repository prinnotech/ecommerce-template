import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { CampaignDelivery, CampaignRecipient } from "@repo/core/backend/types";
import { buildCustomers } from "@repo/core/lib/customers";
import { renderEmail } from "@repo/core/lib/email/layout";
import { fillPlaceholders } from "@repo/core/lib/email/templates";
import { isSmtpConfigured, sendEmail } from "@repo/core/lib/email/transport";
import { getDictionary } from "@repo/core/lib/i18n";
import { publishedLocales } from "@repo/core/lib/languages";
import { localized, localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import { CAMPAIGN_BATCH_SIZE, CAMPAIGN_PLACEHOLDERS } from "@repo/core/lib/schemas/campaigns";
import { matchesSegment, segment_rules_schema } from "@repo/core/lib/schemas/segments";
import { reportError } from "@repo/core/lib/server-log";
import { SITE_URL } from "@repo/core/lib/site-config";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";
import { unsubscribeLinks } from "@repo/core/lib/unsubscribe";

// Marketing → Campaigns: who gets a campaign, the email each person gets, and sending in batches
// (the first batch right after "Send", the rest from the cron route, /api/cron/campaigns).

type CampaignPlaceholder = (typeof CAMPAIGN_PLACEHOLDERS)[number];

// Customers with an account who accepted marketing emails, in the segment ("" = all of them).
// Guests never get campaigns: they never agreed to them.
export async function campaignRecipients(segment_id: string): Promise<CampaignRecipient[] | null> {
  let rules = null;
  if (segment_id) {
    const segment = (await getBackend().segments.list()).find((item) => item.id === segment_id);
    const parsed = segment_rules_schema.safeParse(segment?.rules);
    if (!parsed.success) return null;
    rules = parsed.data;
  }
  const now = Date.now();
  const seen = new Set<string>();
  const recipients: CampaignRecipient[] = [];
  for (const customer of await buildCustomers()) {
    if (!customer.is_registered || !customer.accepts_marketing || !customer.email) continue;
    if (rules && !matchesSegment(customer, rules, now)) continue;
    const email = customer.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({ user_id: customer.key, email: customer.email, name: customer.name, locale: customer.locale });
  }
  return recipients;
}

function text(value: unknown): LocalizedText {
  const parsed = localized_text_schema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

// The language of the recipient's latest order if the store still publishes it, else the default.
function recipientLocale(recipient: Pick<CampaignRecipient, "locale">, settings: SiteSettings): string {
  return publishedLocales(settings.LANGUAGES).includes(recipient.locale) ? recipient.locale : settings.DEFAULT_LOCALE;
}

export type BuiltCampaignEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

export async function buildCampaignEmail(
  campaign: { subject: unknown; body: unknown },
  recipient: CampaignRecipient,
  context?: { settings: SiteSettings; accent_color: string },
): Promise<BuiltCampaignEmail> {
  const settings = context?.settings ?? (await getSiteSettings());
  const accent_color = context?.accent_color ?? (await getLiveTheme()).settings.colors.light.primary;
  const locale = recipientLocale(recipient, settings);
  const values: Record<CampaignPlaceholder, string> = {
    first_name: recipient.name.trim().split(/\s+/)[0] ?? "",
    store_name: settings.SITE_NAME,
    store_link: `${SITE_URL}/${locale}`,
  };
  const subject = fillPlaceholders<CampaignPlaceholder>(localized(text(campaign.subject), locale), values)
    .replace(/\s+/g, " ")
    .trim();
  const body = fillPlaceholders<CampaignPlaceholder>(localized(text(campaign.body), locale), values);
  const links = unsubscribeLinks(recipient.user_id, locale);
  const dictionary = await getDictionary(locale);
  const { email, phone } = settings.SITE_CONTACT;
  const { html, text: plain } = renderEmail({
    store_name: settings.SITE_NAME,
    logo_url: settings.SITE_LOGO_URL,
    accent_color,
    contact_line: [email, phone].filter(Boolean).join(" · "),
    subject,
    body,
    unsubscribe: { url: links.page, label: dictionary.unsubscribe.email_link },
  });
  return {
    to: recipient.email,
    subject,
    html,
    text: plain,
    // One-click unsubscribe (RFC 8058): mail apps show an "Unsubscribe" button that posts here.
    headers: {
      "List-Unsubscribe": `<${links.one_click}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// Sends up to `limit` pending emails of a campaign. Stops early (leaving the rest pending) when the
// email server isn't set up, so nothing is marked failed for a setup problem.
export async function processCampaign(
  id: string,
  limit = CAMPAIGN_BATCH_SIZE,
): Promise<{ sent: number; failed: number; pending: number }> {
  const backend = getBackend().campaigns;
  const campaign = await backend.get(id);
  if (campaign.status !== "sending") return { sent: 0, failed: 0, pending: 0 };
  const settings = await getSiteSettings();
  if (!isSmtpConfigured(settings.SMTP)) return { sent: 0, failed: 0, ...(await backend.refreshCounts(id)) };
  const accent_color = (await getLiveTheme()).settings.colors.light.primary;

  let sent = 0;
  let failed = 0;
  const deliveries: CampaignDelivery[] = await backend.pendingDeliveries(id, limit);
  for (const delivery of deliveries) {
    try {
      const email = await buildCampaignEmail(campaign, delivery, { settings, accent_color });
      const result = await sendEmail({ ...email, template: "campaign" });
      await backend.markDelivery(delivery.id, result.ok ? "sent" : "failed", result.ok ? "" : result.error);
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      await reportError("campaigns", "send one", error);
      await backend.markDelivery(delivery.id, "failed", error instanceof Error ? error.message : "error");
    }
  }
  const { pending } = await backend.refreshCounts(id);
  return { sent, failed, pending };
}

// The cron route: one batch of every campaign that is still sending.
export async function processSendingCampaigns(): Promise<{ campaigns: number; sent: number; failed: number }> {
  const ids = await getBackend().campaigns.sendingIds();
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await processCampaign(id);
    sent += result.sent;
    failed += result.failed;
  }
  return { campaigns: ids.length, sent, failed };
}
