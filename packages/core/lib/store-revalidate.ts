import "server-only";

import { reportError } from "@repo/core/lib/server-log";
import { SITE_URL } from "@repo/core/lib/site-config";
import { revalidateHeaders } from "@repo/core/lib/theme-signing";

// The admin is a separate app, so revalidatePath() here only clears the admin's cache. This asks
// the store to refresh its pages (apps/store/app/api/revalidate). Without the shared secret, or
// if the store doesn't answer, store pages still update within their 60 s revalidate window.
export async function revalidateStore(): Promise<boolean> {
  const headers = revalidateHeaders();
  if (!headers) return false;
  try {
    const response = await fetch(`${SITE_URL}/api/revalidate`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`store revalidate: HTTP ${response.status}`);
    return true;
  } catch (error) {
    await reportError("themes", "revalidateStore", error);
    return false;
  }
}
