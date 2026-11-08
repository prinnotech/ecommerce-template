import "server-only";

import type { Backend } from "@repo/core/backend/types";
import { createSqlBackend } from "@repo/backend-sql/index";
import { supabase_auth } from "@repo/backend-supabase/auth";
import { getDatabase } from "@repo/backend-supabase/db";
import { supabase_storage } from "@repo/backend-supabase/storage";

let backend: Backend | null = null;

// Supabase (BACKEND=supabase): Postgres through the shared SQL code, Supabase Auth and Storage.
// Built on first use so the other backends never need Supabase's env variables.
export function getSupabaseBackend(): Backend {
  backend ??= createSqlBackend({
    name: "supabase",
    context: { db: getDatabase(), dialect: "postgres", storage: supabase_storage },
    auth: supabase_auth,
  });
  return backend;
}
