import "server-only";

import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { reportError } from "@/lib/server-log";

// Unread contact messages, for the dashboard sidebar badge. Call only after checking messages.view.
export async function countUnreadMessages(): Promise<number> {
  try {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("contact_messages").getList(1, 1, { filter: 'status = "new"', fields: "id" });
    return result.totalItems;
  } catch (error) {
    await reportError("messages", "countUnreadMessages", error);
    return 0;
  }
}
