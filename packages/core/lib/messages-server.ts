import "server-only";

import { getBackend } from "@repo/core/backend/index";
import { reportError } from "@repo/core/lib/server-log";

// Unread contact messages, for the dashboard sidebar badge. Call only after checking messages.view.
export async function countUnreadMessages(): Promise<number> {
  try {
    return await getBackend().messages.countUnread();
  } catch (error) {
    await reportError("messages", "countUnreadMessages", error);
    return 0;
  }
}
