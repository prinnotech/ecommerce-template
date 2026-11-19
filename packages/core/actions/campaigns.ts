"use server";

import { after } from "next/server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { CampaignRecord, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, getCurrentUser } from "@repo/core/lib/auth";
import { buildCampaignEmail, campaignRecipients, processCampaign } from "@repo/core/lib/campaigns-server";
import { isSmtpConfigured, sendEmail } from "@repo/core/lib/email/transport";
import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import {
  CAMPAIGN_STATUSES,
  campaign_input_schema,
  campaign_list_filters_schema,
  type CampaignInput,
  type CampaignListFilters,
  type CampaignStatus,
} from "@repo/core/lib/schemas/campaigns";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { reportError } from "@repo/core/lib/server-log";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// Marketing → Campaigns. Drafts can be edited and test-sent; "Send" freezes the recipient list and
// sends the first batch right away; the cron route (/api/cron/campaigns) sends the rest.

export type Campaign = {
  id: string;
  name: string;
  segment_id: string;
  subject: LocalizedText;
  body: LocalizedText;
  status: CampaignStatus;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string;
  created_at: string;
  updated_at: string;
};

const PAGE_SIZE = 25;

function text(value: unknown): LocalizedText {
  const parsed = localized_text_schema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function toCampaign(record: CampaignRecord): Campaign {
  return {
    ...record,
    subject: text(record.subject),
    body: text(record.body),
    status: CAMPAIGN_STATUSES.find((status) => status === record.status) ?? "draft",
  };
}

export async function getCampaigns(input: Partial<CampaignListFilters>): Promise<ActionResult<Page<Campaign>>> {
  const auth = await authorize("campaigns.view", "view campaigns");
  if (!auth.ok) return auth;
  try {
    const page = await getBackend().campaigns.list(campaign_list_filters_schema.parse(input), PAGE_SIZE);
    return ok({ ...page, items: page.items.map(toCampaign) });
  } catch (error) {
    return failFrom(error, "campaigns", "getCampaigns");
  }
}

export async function getCampaign(id: string): Promise<ActionResult<Campaign>> {
  const auth = await authorize("campaigns.view", "view a campaign");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    return ok(toCampaign(await getBackend().campaigns.get(id)));
  } catch (error) {
    return failFrom(error, "campaigns", "getCampaign");
  }
}

// How many people a draft would reach now (the list is frozen when it's sent).
export async function countCampaignRecipients(segment_id: string): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("campaigns.view", "count campaign recipients");
  if (!auth.ok) return auth;
  if (segment_id && !id_schema.safeParse(segment_id).success) return fail("invalid_input");
  try {
    const recipients = await campaignRecipients(segment_id);
    return recipients ? ok({ count: recipients.length }) : fail("not_found");
  } catch (error) {
    return failFrom(error, "campaigns", "countCampaignRecipients");
  }
}

export async function saveCampaign(input: {
  id: string | null;
  campaign: CampaignInput;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("campaigns.edit", "save a campaign");
  if (!auth.ok) return auth;
  const parsed = campaign_input_schema.safeParse(input.campaign);
  if (!parsed.success) return fail("invalid_input");
  if (input.id !== null && !id_schema.safeParse(input.id).success) return fail("not_found");
  try {
    const backend = getBackend().campaigns;
    let id = input.id;
    if (id) {
      if ((await backend.get(id)).status !== "draft") return fail("campaign_sent");
      await backend.update(id, parsed.data);
    } else {
      id = (await backend.create(parsed.data)).id;
    }
    await logActivity({
      actor_id: auth.caller.user_id,
      action: input.id ? "edit a campaign" : "create a campaign",
      target_type: "email_campaigns",
      target_id: id,
      details: { name: parsed.data.name },
    });
    return ok({ id });
  } catch (error) {
    return failFrom(error, "campaigns", "saveCampaign");
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("campaigns.edit", "delete a campaign");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const backend = getBackend().campaigns;
    // A campaign that is going out stays until it's done.
    if ((await backend.get(id)).status === "sending") return fail("campaign_sent");
    await backend.remove(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a campaign",
      target_type: "email_campaigns",
      target_id: id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "campaigns", "deleteCampaign");
  }
}

// The draft as saved, to the signed-in staff member's own address, in a chosen language.
export async function sendCampaignTest(input: { id: string; locale: string }): Promise<ActionResult<{ to: string }>> {
  const auth = await authorize("campaigns.edit", "send a test campaign");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success) return fail("not_found");
  try {
    const [user, smtp, campaign] = await Promise.all([
      getCurrentUser(),
      getSiteSetting("SMTP"),
      getBackend().campaigns.get(input.id),
    ]);
    if (!user?.email) return fail("not_signed_in");
    if (!isSmtpConfigured(smtp)) return fail("smtp_not_configured");
    const email = await buildCampaignEmail(campaign, {
      user_id: user.id,
      email: user.email,
      name: user.name,
      locale: input.locale,
    });
    const result = await sendEmail({ ...email, subject: `[Test] ${email.subject}`, template: "campaign_test" });
    return result.ok ? ok({ to: user.email }) : fail("smtp_failed");
  } catch (error) {
    return failFrom(error, "campaigns", "sendCampaignTest");
  }
}

// Freezes the recipient list and starts sending. The first batch goes out after the response.
export async function sendCampaign(id: string): Promise<ActionResult<{ recipient_count: number }>> {
  const auth = await authorize("campaigns.edit", "send a campaign");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const backend = getBackend().campaigns;
    const [campaign, smtp] = await Promise.all([backend.get(id), getSiteSetting("SMTP")]);
    if (campaign.status !== "draft") return fail("campaign_sent");
    if (!campaign_input_schema.safeParse(toCampaign(campaign)).success) return fail("invalid_input");
    if (!isSmtpConfigured(smtp)) return fail("smtp_not_configured");
    const recipients = await campaignRecipients(campaign.segment_id);
    if (!recipients) return fail("not_found");
    if (recipients.length === 0) return fail("campaign_no_recipients");

    await backend.startSending(id, recipients);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "send a campaign",
      target_type: "email_campaigns",
      target_id: id,
      details: { name: campaign.name, recipients: recipients.length },
    });
    after(async () => {
      try {
        await processCampaign(id);
      } catch (error) {
        await reportError("campaigns", "first batch", error);
      }
    });
    return ok({ recipient_count: recipients.length });
  } catch (error) {
    return failFrom(error, "campaigns", "sendCampaign");
  }
}
