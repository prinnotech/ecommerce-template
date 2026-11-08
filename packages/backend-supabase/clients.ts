import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@repo/backend-supabase/config";

// Per-request client carrying the visitor's session from the auth cookies. Setting cookies only
// works in actions and route handlers; while rendering, Supabase's refresh is done by the proxy.
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookie_store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookie_store.getAll(),
      setAll: (to_set) => {
        try {
          for (const { name, value, options } of to_set) cookie_store.set(name, value, options);
        } catch {
          // Called while rendering a page: cookies are read-only there; the proxy refreshes them.
        }
      },
    },
  });
}

// A client with no cookies, for checks that must not touch the visitor's session
// (e.g. verifying the current password before changing it).
export function createStatelessClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let admin_client: SupabaseClient | null = null;

// Secret-key client: admin auth calls and storage. Server only, after authorization.
export function createAdminClient(): SupabaseClient {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  admin_client ??= createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin_client;
}
