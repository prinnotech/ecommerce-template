"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { SavedView } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { authorize } from "@repo/core/lib/auth";
import {
  SAVED_VIEW_RESOURCES,
  saved_view_id_schema,
  saved_view_schema,
  type SavedViewInput,
  type SavedViewResource,
} from "@repo/core/lib/schemas/admin";

export type { SavedView };

// A staff member's own saved filters for one index table. Everyone with admin access may keep
// their own; nobody sees or deletes anyone else's.
const MAX_VIEWS_PER_TABLE = 20;

export async function getSavedViews(resource: SavedViewResource): Promise<ActionResult<SavedView[]>> {
  const auth = await authorize("dashboard.view", "view saved views");
  if (!auth.ok) return auth;
  if (!SAVED_VIEW_RESOURCES.includes(resource)) return fail("invalid_input");

  try {
    return ok(await getBackend().saved_views.list(auth.caller.user_id, resource));
  } catch (error) {
    return failFrom(error, "saved_views", "getSavedViews");
  }
}

export async function createSavedView(input: SavedViewInput): Promise<ActionResult<SavedView>> {
  const auth = await authorize("dashboard.view", "save a view");
  if (!auth.ok) return auth;
  // The demo account is shared by every visitor: its views would show up for all of them.
  if (auth.caller.is_read_only) return fail("demo_read_only");
  const parsed = saved_view_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const existing = await backend.saved_views.list(auth.caller.user_id, parsed.data.resource);
    if (existing.length >= MAX_VIEWS_PER_TABLE) return fail("invalid_input");
    return ok(await backend.saved_views.create(auth.caller.user_id, parsed.data));
  } catch (error) {
    return failFrom(error, "saved_views", "createSavedView");
  }
}

export async function deleteSavedView(input: { id: string }): Promise<ActionResult<null>> {
  const auth = await authorize("dashboard.view", "delete a saved view");
  if (!auth.ok) return auth;
  if (auth.caller.is_read_only) return fail("demo_read_only");
  const parsed = saved_view_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await getBackend().saved_views.remove(auth.caller.user_id, parsed.data.id);
    return ok(null);
  } catch (error) {
    return failFrom(error, "saved_views", "deleteSavedView");
  }
}
