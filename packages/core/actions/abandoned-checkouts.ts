"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AbandonedCheckoutRow, Page } from "@repo/core/backend/types";
import { sendRecoveryEmail } from "@repo/core/lib/abandoned-checkouts";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { isSmtpConfigured } from "@repo/core/lib/email/transport";
import {
  ABANDONED_AFTER_MS,
  abandoned_checkout_filters_schema,
  type AbandonedCheckoutFilters,
} from "@repo/core/lib/schemas/abandoned-checkouts";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

const PAGE_SIZE = 25;

export type AbandonedCheckoutsPage = Page<AbandonedCheckoutRow> & { is_smtp_configured: boolean; delay_hours: number };

export async function getAbandonedCheckouts(
  input: Partial<AbandonedCheckoutFilters>,
): Promise<ActionResult<AbandonedCheckoutsPage>> {
  const auth = await authorize("orders.view", "view abandoned checkouts");
  if (!auth.ok) return auth;
  const filters = abandoned_checkout_filters_schema.parse(input);
  try {
    const [page, settings] = await Promise.all([
      getBackend().abandoned_checkouts.list(
        filters,
        PAGE_SIZE,
        new Date(Date.now() - ABANDONED_AFTER_MS).toISOString(),
      ),
      getSiteSettings(),
    ]);
    return ok({
      ...page,
      is_smtp_configured: isSmtpConfigured(settings.SMTP),
      delay_hours: settings.NOTIFICATIONS.abandoned_delay_hours,
    });
  } catch (error) {
    return failFrom(error, "abandoned-checkouts", "getAbandonedCheckouts");
  }
}

export async function sendAbandonedCheckoutEmail(session_id: string): Promise<ActionResult<null>> {
  const auth = await authorize("orders.edit", "send an abandoned checkout email");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(session_id).success) return fail("not_found");
  try {
    const settings = await getSiteSettings();
    if (!isSmtpConfigured(settings.SMTP)) return fail("smtp_failed");
    const result = await sendRecoveryEmail(session_id, settings);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "send an abandoned checkout email",
      target_type: "checkout_session",
      target_id: session_id,
      details: { result },
    });
    if (result === "sent") return ok(null);
    return fail(result === "failed" ? "smtp_failed" : "not_found");
  } catch (error) {
    return failFrom(error, "abandoned-checkouts", "sendAbandonedCheckoutEmail");
  }
}
