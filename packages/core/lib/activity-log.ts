import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { ActivityEntry } from "@repo/core/backend/types";
import { reportError } from "@repo/core/lib/server-log";

// Lives in lib/ (not actions/) so the browser can't write log rows.
// A logging failure is reported but never breaks the action that called it.
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await getBackend().activity.log(entry);
  } catch (error) {
    await reportError("activity-log", entry.action, error);
  }
}
