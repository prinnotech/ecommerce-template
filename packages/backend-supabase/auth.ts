import "server-only";

import { cache } from "react";

import { BackendError } from "@repo/core/backend/errors";
import type { AuthBackend, SessionUser } from "@repo/core/backend/types";
import { ADMIN_URL, SITE_URL } from "@repo/core/lib/site-config";
import type { AccountAuth } from "@repo/backend-sql/account";
import { bool } from "@repo/backend-sql/values";
import { createAdminClient, createSessionClient, createStatelessClient } from "@repo/backend-supabase/clients";
import { getDatabase } from "@repo/backend-supabase/db";

// Supabase Auth. The public.users profile row is created and kept in sync by a database trigger
// on auth.users (migration 0002_supabase); name and phone are edited in the profile.
//
// Password links: Supabase's "Reset password" email template must link to
//   {{ .RedirectTo }}?token={{ .TokenHash }}
// Customers' resets redirect to the store's new-password page, staff invites to the admin's
// (both URLs must be in Auth → URL Configuration → Redirect URLs; docs/supabase.md).

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

// Verified with Supabase's auth server (getUser), never from the cookie alone. Cached per request.
const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = await getDatabase()
    .selectFrom("users")
    .select(["id", "email", "name", "phone", "verified"])
    .where("id", "=", data.user.id)
    .executeTakeFirst();
  return {
    id: data.user.id,
    email: data.user.email ?? profile?.email ?? "",
    name: profile?.name ?? String(data.user.user_metadata?.name ?? ""),
    phone: profile?.phone ?? "",
    verified: profile ? bool(profile.verified) : Boolean(data.user.email_confirmed_at),
  };
});

export const supabase_auth: AuthBackend & AccountAuth = {
  getCurrentUser,

  async signIn(email, password) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (errorCode(error) === "invalid_credentials" || error.status === 400)
        throw new BackendError("invalid_credentials");
      throw error;
    }
  },

  // With "Confirm email" on (Supabase's default) the account exists but the visitor is only
  // signed in after clicking the confirmation link.
  async signUp({ name, email, password }) {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) {
      if (errorCode(error) === "user_already_exists" || errorCode(error) === "email_exists")
        throw new BackendError("email_taken");
      if (error.status === 400 || error.status === 422) throw new BackendError("invalid_input");
      throw error;
    }
    // Supabase hides existing accounts when confirmation is on: no identities = already registered.
    if (data.user && data.user.identities?.length === 0) throw new BackendError("email_taken");
    if (data.user) {
      await getDatabase().updateTable("users").set({ name }).where("id", "=", data.user.id).execute();
    }
  },

  async signOut() {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  },

  async requestPasswordReset(email) {
    const supabase = await createSessionClient();
    // No locale in the link: the store's proxy sends the visitor to their language and keeps the token.
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/new-password` });
    if (error) throw error;
  },

  // A new account is created confirmed and without a password; the invite email sets one.
  async ensureUser({ email, name }) {
    const existing = await getDatabase()
      .selectFrom("users")
      .select("id")
      .where("email", "=", email.toLowerCase())
      .executeTakeFirst();
    if (existing) return { user_id: existing.id, is_new: false };
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    await getDatabase().updateTable("users").set({ name }).where("id", "=", data.user.id).execute();
    return { user_id: data.user.id, is_new: true };
  },

  // Supabase sends it with the "Reset password" template, landing on the admin's new-password page.
  async sendStaffInvite(email) {
    const { error } = await createStatelessClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${ADMIN_URL}/new-password`,
    });
    if (error) throw error;
  },

  async confirmPasswordReset(token, password) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
    if (error) throw new BackendError("invalid_token");
    const update = await supabase.auth.updateUser({ password });
    if (update.error) throw update.error;
    // Like the other backends: the reset ends with signing in again.
    await supabase.auth.signOut();
  },

  async changePassword(user, old_password, password) {
    // Check the current password without touching this browser's session.
    const check = await createStatelessClient().auth.signInWithPassword({ email: user.email, password: old_password });
    if (check.error) throw new BackendError("wrong_password");
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  async profileChanged(user_id, profile) {
    await createAdminClient().auth.admin.updateUserById(user_id, { user_metadata: profile });
  },
};
