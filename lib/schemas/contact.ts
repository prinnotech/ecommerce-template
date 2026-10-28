import { z } from "zod";

import { email_schema } from "@/lib/schemas/auth";

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
  id: z.string().regex(/^[a-z0-9]{15}$/),
  status: z.enum(MESSAGE_STATUSES),
});
export type SetMessageStatusInput = z.infer<typeof set_message_status_schema>;
