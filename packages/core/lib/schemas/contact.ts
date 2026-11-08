import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { email_schema } from "@repo/core/lib/schemas/auth";
import { bulk_ids_schema } from "@repo/core/lib/schemas/admin";
import { id_schema } from "@repo/core/lib/schemas/ids";

export const contact_message_schema = z.object({
  name: z.string("required").trim().min(1, "required").max(120, "too_long"),
  email: email_schema,
  phone: z.string().trim().max(30, "too_long"),
  subject: z.string().trim().max(200, "too_long"),
  message: z.string("required").trim().min(1, "required").max(5000, "too_long"),
  // Honeypot: hidden from people, filled in by bots. Any value makes the message silently dropped.
  website: z.string().max(200),
});
export type ContactMessageInput = z.infer<typeof contact_message_schema>;

export const MESSAGE_STATUSES = ["new", "read", "archived"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const message_filters_schema = z.object({
  status: z.enum(["inbox", ...MESSAGE_STATUSES]).catch("inbox"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type MessageFilters = z.infer<typeof message_filters_schema>;

export const set_message_status_schema = z.object({
  id: id_schema,
  status: z.enum(MESSAGE_STATUSES),
});
export type SetMessageStatusInput = z.infer<typeof set_message_status_schema>;

export const bulk_message_status_schema = z.object({ ids: bulk_ids_schema, status: z.enum(MESSAGE_STATUSES) });
export type BulkMessageStatusInput = z.infer<typeof bulk_message_status_schema>;

// The theme's newsletter section. Saved as a message, so staff see sign-ups in Messages.
export const newsletter_signup_schema = z.object({
  email: email_schema,
  lang: z.enum(LOCALES),
  // Honeypot, like the contact form.
  website: z.string().max(200),
});
export type NewsletterSignupInput = z.infer<typeof newsletter_signup_schema>;
