import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";

import { getBackend } from "@repo/core/backend/index";
import type { SessionUser } from "@repo/core/backend/types";

// Staff API keys, used by the MCP server (app/api/mcp in the admin). A key acts as the staff member
// who created it: every tool runs the normal actions inside runAsApiUser(), where getCurrentUser()
// returns that account instead of reading the session cookie, so roles, the read-only demo role and
// the activity log all apply unchanged.

const KEY_PREFIX = "sk_store_";

// The key is 32 random bytes, so a plain SHA-256 is enough to store it (no slow hash needed).
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; key_prefix: string; key_hash: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, key_prefix: key.slice(0, KEY_PREFIX.length + 6), key_hash: hashApiKey(key) };
}

const api_user_storage = new AsyncLocalStorage<SessionUser>();

// The account of the API key the current request runs as, or undefined for normal requests.
export function currentApiUser(): SessionUser | undefined {
  return api_user_storage.getStore();
}

export function runAsApiUser<T>(user: SessionUser, run: () => Promise<T>): Promise<T> {
  return api_user_storage.run(user, run);
}

// The account behind an "Authorization: Bearer <key>" value, or null for an unknown or revoked key.
export async function resolveApiKey(key: string): Promise<SessionUser | null> {
  if (!key.startsWith(KEY_PREFIX) || key.length > 200) return null;
  const backend = getBackend().api_keys;
  const found = await backend.findActive(hashApiKey(key));
  if (!found) return null;
  await backend.touch(found.id);
  return found.user;
}
