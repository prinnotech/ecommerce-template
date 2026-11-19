import { z } from "zod";

import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import { id_schema } from "@repo/core/lib/schemas/ids";

// Marketing → Campaigns: one email to the customers of a segment who accepted marketing emails.

export const CAMPAIGN_STATUSES = ["draft", "sending", "sent"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// What the subject and text can contain; filled per recipient.
export const CAMPAIGN_PLACEHOLDERS = ["first_name", "store_name", "store_link"] as const;

function hasText(text: LocalizedText): boolean {
  return Object.values(text).some((value) => value.trim().length > 0);
}

export const campaign_input_schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    // "" = every customer who accepted marketing emails.
    segment_id: z.union([id_schema, z.literal("")]),
    subject: localized_text_schema,
    // Plain text: a blank line starts a paragraph, "# " a heading, "- " a list.
    body: localized_text_schema,
  })
  .refine((input) => hasText(input.subject), { path: ["subject"] })
  .refine((input) => hasText(input.body), { path: ["body"] });
export type CampaignInput = z.infer<typeof campaign_input_schema>;

export const EMPTY_CAMPAIGN: CampaignInput = { name: "", segment_id: "", subject: {}, body: {} };

export const campaign_list_filters_schema = z.object({
  status: z.enum(["all", ...CAMPAIGN_STATUSES]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type CampaignListFilters = z.infer<typeof campaign_list_filters_schema>;

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// Emails sent per run (the send button's run, then each cron run).
export const CAMPAIGN_BATCH_SIZE = 100;
