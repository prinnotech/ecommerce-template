import "server-only";

import type { Backend } from "@repo/core/backend/types";
import { pocketbase_backend } from "@repo/backend-pocketbase/index";
import { getSqliteBackend } from "@repo/backend-sqlite/index";
import { getSupabaseBackend } from "@repo/backend-supabase/index";

// Which backend the apps use, from the BACKEND env variable. Only server code calls this.
// "pocketbase" stays the default until existing deployments set BACKEND explicitly.
export const BACKEND_NAME = (process.env.BACKEND ?? "pocketbase") as Backend["name"];

export function getBackend(): Backend {
  switch (BACKEND_NAME) {
    case "supabase":
      return getSupabaseBackend();
    case "sqlite":
      return getSqliteBackend();
    case "pocketbase":
      return pocketbase_backend;
    default:
      throw new Error(`Unknown BACKEND=${BACKEND_NAME}. Use "supabase", "sqlite" or "pocketbase".`);
  }
}
