"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { GiftCard, GiftCardTransaction, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { issueGiftCard, sendGiftCardEmail } from "@repo/core/lib/gift-cards-server";
import {
  gift_card_filters_schema,
  issue_gift_card_schema,
  type GiftCardFilters,
  type IssueGiftCardInput,
} from "@repo/core/lib/schemas/gift-cards";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// Products → Gift cards (admin). Codes are shown in full only to staff who can edit.

const PAGE_SIZE = 25;

export async function getGiftCards(input: Partial<GiftCardFilters>): Promise<ActionResult<Page<GiftCard>>> {
  const auth = await authorize("gift_cards.view", "view gift cards");
  if (!auth.ok) return auth;
  const filters = gift_card_filters_schema.parse(input);
  try {
    return ok(await getBackend().gift_cards.list(filters, PAGE_SIZE, new Date().toISOString()));
  } catch (error) {
    return failFrom(error, "gift-cards", "getGiftCards");
  }
}

export async function getGiftCard(
  id: string,
): Promise<ActionResult<GiftCard & { transactions: GiftCardTransaction[] }>> {
  const auth = await authorize("gift_cards.view", "view a gift card");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    return ok(await getBackend().gift_cards.get(id));
  } catch (error) {
    return failFrom(error, "gift-cards", "getGiftCard");
  }
}

export async function issueGiftCardByStaff(
  input: IssueGiftCardInput,
): Promise<ActionResult<{ id: string; code: string }>> {
  const auth = await authorize("gift_cards.edit", "issue a gift card");
  if (!auth.ok) return auth;
  const parsed = issue_gift_card_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { amount, expires_at, customer_email, note, is_notify } = parsed.data;
  try {
    const settings = await getSiteSettings();
    const card = await issueGiftCard({
      amount,
      expires_at,
      customer_email,
      note,
      order_id: "",
      created_by: auth.caller.user_id,
      currency: settings.CURRENCY,
    });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "issue a gift card",
      target_type: "gift_card",
      target_id: card.id,
      details: { amount, customer_email },
    });
    if (is_notify && customer_email) {
      await sendGiftCardEmail(
        { code: card.code, balance: amount, expires_at, customer_email },
        { to: customer_email, customer_name: "", locale: settings.DEFAULT_LOCALE },
      );
    }
    return ok(card);
  } catch (error) {
    return failFrom(error, "gift-cards", "issueGiftCardByStaff");
  }
}

export async function setGiftCardActive(input: { id: string; is_active: boolean }): Promise<ActionResult<null>> {
  const auth = await authorize("gift_cards.edit", "change a gift card");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success || typeof input.is_active !== "boolean") return fail("invalid_input");
  try {
    await getBackend().gift_cards.setActive(input.id, input.is_active);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change a gift card",
      target_type: "gift_card",
      target_id: input.id,
      details: { is_active: input.is_active },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "gift-cards", "setGiftCardActive");
  }
}
