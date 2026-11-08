"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { InboxMessage, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { authorize } from "@repo/core/lib/auth";
import { getDictionary } from "@repo/core/lib/i18n";
import { getClientIp, isRateLimited } from "@repo/core/lib/rate-limit";
import {
  bulk_message_status_schema,
  contact_message_schema,
  message_filters_schema,
  newsletter_signup_schema,
  set_message_status_schema,
  type BulkMessageStatusInput,
  type ContactMessageInput,
  type MessageFilters,
  type NewsletterSignupInput,
  type SetMessageStatusInput,
} from "@repo/core/lib/schemas/contact";

const PAGE_SIZE = 25;

export type { InboxMessage };
export type InboxPage = Page<InboxMessage>;

// Public: the contact page form. Messages are private, so the message is written on the server
// after validation and rate limiting; nothing is returned.
export async function submitContactMessage(input: ContactMessageInput): Promise<ActionResult<null>> {
  const parsed = contact_message_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  // Bots get the same success answer, so they don't learn to skip the honeypot.
  if (parsed.data.website) return ok(null);

  const ip = await getClientIp();
  if (isRateLimited(`contact:${ip}`, 5, 60 * 60_000)) return fail("rate_limited");

  try {
    const { website: _website, ...message } = parsed.data;
    await getBackend().messages.create(message);
    return ok(null);
  } catch (error) {
    return failFrom(error, "contact", "submitContactMessage");
  }
}

// Public: the theme's newsletter section. Saved as a message (subject in the visitor's language),
// so staff find sign-ups in Messages; same honeypot and rate limit as the contact form.
export async function subscribeNewsletter(input: NewsletterSignupInput): Promise<ActionResult<null>> {
  const parsed = newsletter_signup_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  if (parsed.data.website) return ok(null);

  const ip = await getClientIp();
  if (isRateLimited(`newsletter:${ip}`, 5, 60 * 60_000)) return fail("rate_limited");

  try {
    const dictionary = await getDictionary(parsed.data.lang);
    await getBackend().messages.create({
      name: "",
      email: parsed.data.email,
      phone: "",
      subject: dictionary.newsletter.message_subject,
      message: dictionary.newsletter.message_body.replace("{email}", parsed.data.email),
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "contact", "subscribeNewsletter");
  }
}

export async function getMessages(input: Partial<MessageFilters>): Promise<ActionResult<InboxPage>> {
  const auth = await authorize("messages.view", "view contact messages");
  if (!auth.ok) return auth;
  const filters = message_filters_schema.parse(input);

  try {
    return ok(await getBackend().messages.list(filters, PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "contact", "getMessages");
  }
}

// Triage (read / unread / archive) is part of reading the inbox, so it uses messages.view.
export async function setMessageStatus(input: SetMessageStatusInput): Promise<ActionResult<null>> {
  const auth = await authorize("messages.view", "update a contact message");
  if (!auth.ok) return auth;
  // A write under a .view permission: read-only roles (the demo) are refused here explicitly.
  if (auth.caller.is_read_only) return fail("demo_read_only");
  const parsed = set_message_status_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await getBackend().messages.setStatus(parsed.data.id, parsed.data.status);
    return ok(null);
  } catch (error) {
    return failFrom(error, "contact", "setMessageStatus");
  }
}

export async function bulkSetMessageStatus(input: BulkMessageStatusInput): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("messages.view", "update contact messages");
  if (!auth.ok) return auth;
  if (auth.caller.is_read_only) return fail("demo_read_only");
  const parsed = bulk_message_status_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    return ok({ count: await getBackend().messages.setStatusMany(parsed.data.ids, parsed.data.status) });
  } catch (error) {
    return failFrom(error, "contact", "bulkSetMessageStatus");
  }
}
