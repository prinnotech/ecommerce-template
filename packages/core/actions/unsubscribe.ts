"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { isValidUnsubscribeToken } from "@repo/core/lib/unsubscribe";

// Public: the link at the bottom of every marketing email. The signed token is the authorization,
// so a visitor can only unsubscribe the address the email went to.
export async function unsubscribeFromMarketing(input: { user_id: string; token: string }): Promise<ActionResult<null>> {
  if (!id_schema.safeParse(input.user_id).success || typeof input.token !== "string") return fail("invalid_token");
  if (!isValidUnsubscribeToken(input.user_id, input.token)) return fail("invalid_token");
  try {
    await getBackend().customers.setAcceptsMarketing(input.user_id, false);
    await logActivity({
      actor_id: null,
      action: "unsubscribe from marketing emails",
      target_type: "users",
      target_id: input.user_id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "unsubscribe", "unsubscribeFromMarketing");
  }
}
