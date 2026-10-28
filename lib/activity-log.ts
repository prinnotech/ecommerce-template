import "server-only";

import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { reportError } from "@/lib/server-log";

type ActivityEntry = {
  actor_id: string | null;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  is_denied?: boolean;
};

// Lives in lib/ (not app/actions/) so the browser can't write log rows.
// A logging failure is reported but never breaks the action that called it.
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const pb = await createAdminPocketBase();
    await pb.collection("activity_log").create({
      actor: entry.actor_id ?? "",
      action: entry.action,
      target_type: entry.target_type ?? "",
      target_id: entry.target_id ?? "",
      details: entry.details ?? null,
      is_denied: entry.is_denied ?? false,
    });
  } catch (error) {
    await reportError("activity-log", entry.action, error);
  }
}
