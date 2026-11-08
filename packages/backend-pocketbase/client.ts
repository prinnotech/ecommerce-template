import "server-only";

import { cookies } from "next/headers";
import PocketBase from "pocketbase";
import { cache } from "react";

import { AUTH_COOKIE, AUTH_COOKIE_OPTIONS } from "@repo/backend-pocketbase/cookie";
import { POCKETBASE_URL } from "@repo/backend-pocketbase/config";
import type { TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

function newClient(): TypedPocketBase {
  const pb = new PocketBase(POCKETBASE_URL) as TypedPocketBase;
  // Server requests are independent; the SDK's auto-cancel would abort parallel reads.
  pb.autoCancellation(false);
  return pb;
}

// Read the token once per request and reuse it.
const readAuthToken = cache(async () => (await cookies()).get(AUTH_COOKIE)?.value);

// Per-request client carrying the visitor's token from the pb_auth cookie.
// Queries run under the collections' API rules. This is the default client.
export async function createServerPocketBase(): Promise<TypedPocketBase> {
  const pb = newClient();
  const token = await readAuthToken();
  if (token) pb.authStore.save(token, null);
  return pb;
}

// Anonymous client for public storefront reads. It never touches cookies, so pages
// that only use it can be statically rendered and revalidated.
export function createPublicPocketBase(): TypedPocketBase {
  return newClient();
}

// The superuser token is shared across requests (it isn't user data) and reused until it expires.
let superuser_token: string | null = null;

// Superuser client: bypasses every API rule. Use ONLY after authorizing the caller,
// or for trusted server work (webhooks, config reads). Never return its raw results unfiltered.
export async function createAdminPocketBase(): Promise<TypedPocketBase> {
  const pb = newClient();
  if (superuser_token) {
    pb.authStore.save(superuser_token, null);
    if (pb.authStore.isValid) return pb;
  }

  const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  if (!email || !password) throw new Error("POCKETBASE_SUPERUSER_EMAIL / POCKETBASE_SUPERUSER_PASSWORD are not set");

  await pb.collection("_superusers").authWithPassword(email, password);
  superuser_token = pb.authStore.token;
  return pb;
}

// Only callable from server actions and route handlers (cookies can't be set while rendering).
export async function setAuthCookie(token: string): Promise<void> {
  (await cookies()).set(AUTH_COOKIE, token, AUTH_COOKIE_OPTIONS);
}

export async function clearAuthCookie(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIE);
}
