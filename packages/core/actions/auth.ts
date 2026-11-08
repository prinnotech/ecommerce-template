"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { getClientIp, isRateLimited } from "@repo/core/lib/rate-limit";
import {
  confirm_password_reset_schema,
  request_password_reset_schema,
  sign_in_schema,
  sign_up_schema,
  type ConfirmPasswordResetInput,
  type RequestPasswordResetInput,
  type SignInInput,
  type SignUpInput,
} from "@repo/core/lib/schemas/auth";
import { reportError } from "@repo/core/lib/server-log";

const MINUTE = 60_000;

export async function signIn(input: SignInInput): Promise<ActionResult<null>> {
  const parsed = sign_in_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { email, password } = parsed.data;

  const ip = await getClientIp();
  if (isRateLimited(`sign_in:${ip}:${email}`, 10, 15 * MINUTE) || isRateLimited(`sign_in:${ip}`, 30, 15 * MINUTE)) {
    return fail("rate_limited");
  }

  try {
    await getBackend().auth.signIn(email, password);
    return ok(null);
  } catch (error) {
    return failFrom(error, "auth", "signIn");
  }
}

export async function signUp(input: SignUpInput): Promise<ActionResult<null>> {
  const parsed = sign_up_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { name, email, password } = parsed.data;

  const ip = await getClientIp();
  if (isRateLimited(`sign_up:${ip}`, 5, 60 * MINUTE)) return fail("rate_limited");

  try {
    await getBackend().auth.signUp({ name, email, password });
    return ok(null);
  } catch (error) {
    return failFrom(error, "auth", "signUp");
  }
}

export async function signOut(): Promise<ActionResult<null>> {
  await getBackend().auth.signOut();
  return ok(null);
}

// Always succeeds for a valid email, so the form can't be used to find out who has an account.
export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<ActionResult<null>> {
  const parsed = request_password_reset_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  // The public demo account's password never resets (and no email goes out for it).
  if (process.env.DEMO_MODE === "true" && parsed.data.email.toLowerCase() === "demo@admin.com") {
    return fail("demo_read_only");
  }

  const ip = await getClientIp();
  if (isRateLimited(`password_reset:${ip}`, 5, 60 * MINUTE)) return fail("rate_limited");

  try {
    await getBackend().auth.requestPasswordReset(parsed.data.email);
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
    await getBackend().auth.confirmPasswordReset(token, password);
    return ok(null);
  } catch (error) {
    return failFrom(error, "auth", "confirmPasswordReset");
  }
}
