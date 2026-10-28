"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { authorize } from "@/lib/auth";
import { pocketBaseStatus } from "@/lib/pocketbase/errors";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  contact_message_schema,
  message_filters_schema,
  set_message_status_schema,
  type ContactMessageInput,
  type MessageFilters,
  type SetMessageStatusInput,
} from "@/lib/schemas/contact";
import { reportError } from "@/lib/server-log";
import type { ContactMessagesResponse } from "@/types/pocketbase-types";

const PAGE_SIZE = 25;

export type InboxMessage = Pick<
  ContactMessagesResponse,
  "id" | "name" | "email" | "phone" | "subject" | "message" | "status" | "created_at"
>;
export type InboxPage = { items: InboxMessage[]; page: number; total_pages: number; total_items: number };

// Public: the contact page form. contact_messages is locked in PocketBase, so the message is
// written with the admin client after validation and rate limiting; nothing is returned.
export async function submitContactMessage(input: ContactMessageInput): Promise<ActionResult<null>> {
  const parsed = contact_message_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  // Bots get the same success answer, so they don't learn to skip the honeypot.
  if (parsed.data.website) return ok(null);

  const ip = await getClientIp();
  if (isRateLimited(`contact:${ip}`, 5, 60 * 60_000)) return fail("rate_limited");

  try {
    const { website: _website, ...message } = parsed.data;
    const pb = await createAdminPocketBase();
    await pb.collection("contact_messages").create({ ...message, status: "new" });
    return ok(null);
  } catch (error) {
    await reportError("contact", "submitContactMessage", error);
    return fail("generic");
  }
}

export async function getMessages(input: Partial<MessageFilters>): Promise<ActionResult<InboxPage>> {
  const auth = await authorize("messages.view", "view contact messages");
  if (!auth.ok) return auth;
  const filters = message_filters_schema.parse(input);

  try {
    const pb = await createAdminPocketBase();
    // "Inbox" = everything not archived.
    const filter =
      filters.status === "inbox" ? 'status != "archived"' : pb.filter("status = {:status}", { status: filters.status });
    const result = await pb.collection("contact_messages").getList(filters.page, PAGE_SIZE, {
      filter,
      sort: "-created_at",
      fields: "id,name,email,phone,subject,message,status,created_at",
    });
    return ok({
      items: result.items,
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    });
  } catch (error) {
    await reportError("contact", "getMessages", error);
    return fail("generic");
  }
}

// Triage (read / unread / archive) is part of reading the inbox, so it uses messages.view.
export async function setMessageStatus(input: SetMessageStatusInput): Promise<ActionResult<null>> {
  const auth = await authorize("messages.view", "update a contact message");
  if (!auth.ok) return auth;
  const parsed = set_message_status_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    await pb.collection("contact_messages").update(parsed.data.id, { status: parsed.data.status });
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("contact", "setMessageStatus", error);
    return fail("generic");
  }
}
