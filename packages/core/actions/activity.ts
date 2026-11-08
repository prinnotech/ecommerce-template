"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { ActivityRow, Page } from "@repo/core/backend/types";
import { ok, type ActionResult } from "@repo/core/lib/action-result";
import { authorize } from "@repo/core/lib/auth";
import { activity_filters_schema, type ActivityFilters } from "@repo/core/lib/schemas/admin";

const PAGE_SIZE = 50;

export type { ActivityRow };
export type ActivityPage = Page<ActivityRow>;

export async function getActivityLog(input: Partial<ActivityFilters>): Promise<ActionResult<ActivityPage>> {
  const auth = await authorize("audit.view", "view the activity log");
  if (!auth.ok) return auth;
  const filters = activity_filters_schema.parse(input);

  try {
    return ok(await getBackend().activity.list(filters, PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "activity", "getActivityLog");
  }
}
