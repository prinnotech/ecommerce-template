// Proxy helpers for Supabase. No "server-only": proxy.ts can't load server-only modules.
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@repo/backend-supabase/config";

// Refreshes the Supabase session cookies on the way through (Supabase's documented middleware
// pattern). getUser() validates the token and rotates it when it's close to expiring.
export async function updateSession(request: NextRequest, response: NextResponse): Promise<void> {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (to_set) => {
        for (const { name, value, options } of to_set) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // Supabase unreachable: keep the current cookies and try again on the next request.
  }
}

// A public site setting through Supabase's REST API with the publishable key. The only RLS
// policy in the schema allows exactly this: reading site_settings rows marked is_public.
export async function readPublicSetting(key: string): Promise<unknown> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/site_settings?select=value&key=eq.${encodeURIComponent(key)}&limit=1`,
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(2000) },
  );
  if (!response.ok) return undefined;
  const rows: unknown = await response.json();
  if (Array.isArray(rows) && rows[0] && typeof rows[0] === "object" && "value" in rows[0]) return rows[0].value;
  return undefined;
}
