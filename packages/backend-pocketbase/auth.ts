import "server-only";

import { cache } from "react";

import { BackendError } from "@repo/core/backend/errors";
import type { AuthBackend, SessionUser } from "@repo/core/backend/types";
import { randomBytes } from "node:crypto";

import {
  clearAuthCookie,
  createAdminPocketBase,
  createServerPocketBase,
  setAuthCookie,
} from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";

// A client with no visitor token, for the auth calls themselves.
async function anonymousClient() {
  const pb = await createServerPocketBase();
  pb.authStore.clear();
  return pb;
}

// Cached per request: layouts, pages and actions all ask who the visitor is.
const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const pb = await createServerPocketBase();
  if (!pb.authStore.token) return null;
  try {
    // `fields` applies to the whole auth response ({ token, record }), hence the record. prefix.
    const { record } = await pb
      .collection("users")
      .authRefresh({ fields: "record.id,record.email,record.name,record.phone,record.verified" });
    if (!record?.id) return null;
    return { id: record.id, email: record.email, name: record.name, phone: record.phone, verified: record.verified };
  } catch {
    // Invalid, expired or revoked token: treat as signed out.
    return null;
  }
});

export const auth: AuthBackend = {
  getCurrentUser,

  async signIn(email, password) {
    const pb = await anonymousClient();
    try {
      await pb.collection("users").authWithPassword(email, password);
    } catch (error) {
      if (pocketBaseStatus(error) === 400) throw new BackendError("invalid_credentials");
      throw error;
    }
    await setAuthCookie(pb.authStore.token);
  },

  async signUp({ name, email, password }) {
    const pb = await anonymousClient();
    try {
      await pb.collection("users").create({ name, email, password, passwordConfirm: password, emailVisibility: false });
    } catch (error) {
      if (pocketBaseFieldCode(error, "email") === "validation_not_unique") throw new BackendError("email_taken");
      if (pocketBaseStatus(error) === 400) throw new BackendError("invalid_input");
      throw error;
    }
    await pb.collection("users").authWithPassword(email, password);
    await setAuthCookie(pb.authStore.token);
  },

  async signOut() {
    await clearAuthCookie();
  },

  async requestPasswordReset(email) {
    const pb = await anonymousClient();
    await pb.collection("users").requestPasswordReset(email);
  },

  async confirmPasswordReset(token, password) {
    const pb = await anonymousClient();
    try {
      await pb.collection("users").confirmPasswordReset(token, password, password);
    } catch (error) {
      if (pocketBaseStatus(error) === 400) throw new BackendError("invalid_token");
      throw error;
    }
    // The reset invalidates every existing session, including this browser's.
    await clearAuthCookie();
  },

  // PocketBase needs a password on every account: a random one nobody knows, replaced through
  // the invite (password-reset) link.
  async ensureUser({ email, name }) {
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("users")
      .getFirstListItem(pb.filter("email = {:email}", { email: email.toLowerCase() }), { fields: "id" })
      .catch(() => null);
    if (existing) return { user_id: existing.id, is_new: false };
    const password = randomBytes(24).toString("base64url");
    const record = await pb.collection("users").create({
      email,
      name,
      password,
      passwordConfirm: password,
      emailVisibility: false,
      verified: true,
    });
    return { user_id: record.id, is_new: true };
  },

  // PocketBase sends its own reset email; the link goes to PB_APP_URL (the store's new-password
  // page), which works for staff accounts too since they share the users collection.
  async sendStaffInvite(email) {
    const pb = await anonymousClient();
    await pb.collection("users").requestPasswordReset(email);
  },
};
