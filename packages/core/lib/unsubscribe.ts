import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverSecret } from "@repo/core/lib/server-secret";
import { SITE_URL } from "@repo/core/lib/site-config";

// Signed unsubscribe links for marketing emails: /{lang}/unsubscribe?u=<user id>&t=<signature>.
// The signature proves the link came from one of our emails, so nobody can unsubscribe someone else
// by guessing an id. Uses the store's shared server secret with its own prefix.

function sign(user_id: string): string {
  return createHmac("sha256", serverSecret("THEME_PREVIEW_SECRET"))
    .update(`unsubscribe:${user_id}`)
    .digest("base64url");
}

export function unsubscribeToken(user_id: string): string {
  return sign(user_id);
}

export function isValidUnsubscribeToken(user_id: string, token: string): boolean {
  if (!user_id || !token || serverSecret("THEME_PREVIEW_SECRET").length < 16) return false;
  const expected = Buffer.from(sign(user_id));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// The page a person sees, and the one-click endpoint mail apps call (List-Unsubscribe-Post).
export function unsubscribeLinks(user_id: string, locale: string): { page: string; one_click: string } {
  const query = `u=${encodeURIComponent(user_id)}&t=${unsubscribeToken(user_id)}`;
  return { page: `${SITE_URL}/${locale}/unsubscribe?${query}`, one_click: `${SITE_URL}/api/unsubscribe?${query}` };
}
