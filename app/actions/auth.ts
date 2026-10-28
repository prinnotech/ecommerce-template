"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { pocketBaseFieldCode, pocketBaseStatus } from "@/lib/pocketbase/errors";
import { clearAuthCookie, createServerPocketBase, setAuthCookie } from "@/lib/pocketbase/pocketbase-server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  confirm_password_reset_schema,
  request_password_reset_schema,
  sign_in_schema,
  sign_up_schema,
  type ConfirmPasswordResetInput,
  type RequestPasswordResetInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/schemas/auth";
import { reportError } from "@/lib/server-log";

const MINUTE = 60_000;

// A client with no visitor token, for the auth calls themselves.
async function anonymousClient() {
  const pb = await createServerPocketBase();
  pb.authStore.clear();
  return pb;
}

export async function signIn(input: SignInInput): Promise<ActionResult<null>> {
  const parsed = sign_in_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { email, password } = parsed.data;

  const ip = await getClientIp();
  if (isRateLimited(`sign_in:${ip}:${email}`, 10, 15 * MINUTE) || isRateLimited(`sign_in:${ip}`, 30, 15 * MINUTE)) {
    return fail("rate_limited");
  }

  try {
    const pb = await anonymousClient();
    await pb.collection("users").authWithPassword(email, password);
    await setAuthCookie(pb.authStore.token);
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 400) return fail("invalid_credentials");
    await reportError("auth", "signIn", error);
    return fail("generic");
  }
}

export async function signUp(input: SignUpInput): Promise<ActionResult<null>> {
  const parsed = sign_up_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { name, email, password } = parsed.data;

  const ip = await getClientIp();
  if (isRateLimited(`sign_up:${ip}`, 5, 60 * MINUTE)) return fail("rate_limited");

  try {
    const pb = await anonymousClient();
    await pb.collection("users").create({ name, email, password, passwordConfirm: password, emailVisibility: false });
    await pb.collection("users").authWithPassword(email, password);
    await setAuthCookie(pb.authStore.token);
    return ok(null);
  } catch (error) {
    if (pocketBaseFieldCode(error, "email") === "validation_not_unique") return fail("email_taken");
    if (pocketBaseStatus(error) === 400) return fail("invalid_input");
    await reportError("auth", "signUp", error);
    return fail("generic");
  }
}

export async function signOut(): Promise<ActionResult<null>> {
  await clearAuthCookie();
  return ok(null);
}

// Always succeeds for a valid email, so the form can't be used to find out who has an account.
export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<ActionResult<null>> {
  const parsed = request_password_reset_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  const ip = await getClientIp();
  if (isRateLimited(`password_reset:${ip}`, 5, 60 * MINUTE)) return fail("rate_limited");

  try {
    const pb = await anonymousClient();
    await pb.collection("users").requestPasswordReset(parsed.data.email);
  } catch (error) {
    await reportError("auth", "requestPasswordReset", error);
  }
  return ok(null);
}

export async function confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<ActionResult<null>> {
  const parsed = confirm_password_reset_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { token, password } = parsed.data;

  const ip = await getClientIp();
  if (isRateLimited(`password_reset_confirm:${ip}`, 10, 60 * MINUTE)) return fail("rate_limited");

  try {
    const pb = await anonymousClient();
    await pb.collection("users").confirmPasswordReset(token, password, password);
    // The reset invalidates every existing session, including this browser's.
    await clearAuthCookie();
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 400) return fail("invalid_token");
    await reportError("auth", "confirmPasswordReset", error);
    return fail("generic");
  }
}
