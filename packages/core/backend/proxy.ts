// What proxy.ts needs from the backend (session refresh, public settings). Unlike the rest of
// backend/, this must not import "server-only": the proxy can't load server-only modules.
import type { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE as POCKETBASE_COOKIE } from "@repo/backend-pocketbase/cookie";
import {
  readPublicSetting as readPocketBaseSetting,
  updateSession as updatePocketBaseSession,
} from "@repo/backend-pocketbase/proxy";
import { SESSION_COOKIE_NAME as SQLITE_COOKIE } from "@repo/backend-sqlite/config";
import { readPublicSetting as readSqliteSetting } from "@repo/backend-sqlite/proxy";
import { isSessionCookie as isSupabaseSessionCookie } from "@repo/backend-supabase/config";
import {
  readPublicSetting as readSupabaseSetting,
  updateSession as updateSupabaseSession,
} from "@repo/backend-supabase/proxy";

const BACKEND = process.env.BACKEND ?? "pocketbase";

// Someone may be signed in: only then does the proxy refresh the session (SQLite sessions need no refresh).
export function hasSessionCookie(request: NextRequest): boolean {
  if (BACKEND === "supabase") return request.cookies.getAll().some((cookie) => isSupabaseSessionCookie(cookie.name));
  if (BACKEND === "sqlite") return request.cookies.has(SQLITE_COOKIE);
  return request.cookies.has(POCKETBASE_COOKIE);
}

export async function updateSession(request: NextRequest, response: NextResponse): Promise<void> {
  if (BACKEND === "supabase") await updateSupabaseSession(request, response);
  else if (BACKEND === "pocketbase") await updatePocketBaseSession(request, response);
}

// A public site setting's stored value (undefined = not stored). Used for DEFAULT_LOCALE.
export async function readPublicSetting(key: string): Promise<unknown> {
  if (BACKEND === "supabase") return readSupabaseSetting(key);
  if (BACKEND === "sqlite") return readSqliteSetting(key);
  if (BACKEND === "pocketbase") return readPocketBaseSetting(key);
  return undefined;
}
