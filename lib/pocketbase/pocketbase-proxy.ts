import type { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, AUTH_COOKIE_OPTIONS, getTokenExpiry } from "@/lib/pocketbase/auth-cookie";
import { POCKETBASE_URL } from "@/lib/site-config";

// Refresh when less than this much time is left on the token.
const REFRESH_WINDOW_SECONDS = 60 * 60 * 24 * 2;

// Called only from proxy.ts, and only when an auth cookie exists.
// Keeps active visitors signed in and drops a cookie PocketBase no longer accepts.
export async function updateSession(request: NextRequest, response: NextResponse): Promise<void> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return;

  const expires_at = getTokenExpiry(token);
  const now = Math.floor(Date.now() / 1000);
  if (expires_at === null || expires_at <= now) {
    response.cookies.delete(AUTH_COOKIE);
    return;
  }
  if (expires_at - now > REFRESH_WINDOW_SECONDS) return;

  try {
    const refresh = await fetch(`${POCKETBASE_URL}/api/collections/users/auth-refresh`, {
      method: "POST",
      headers: { Authorization: token },
    });
    if (refresh.status === 401 || refresh.status === 403 || refresh.status === 404) {
      response.cookies.delete(AUTH_COOKIE);
      return;
    }
    if (!refresh.ok) return;
    const body: unknown = await refresh.json();
    if (typeof body === "object" && body !== null && "token" in body && typeof body.token === "string") {
      response.cookies.set(AUTH_COOKIE, body.token, AUTH_COOKIE_OPTIONS);
    }
  } catch {
    // PocketBase unreachable: keep the current cookie and try again on the next request.
  }
}
