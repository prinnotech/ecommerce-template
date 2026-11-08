import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { BackendError } from "@repo/core/backend/errors";
import type { AuthBackend, SessionUser } from "@repo/core/backend/types";
import { ADMIN_URL, SITE_URL } from "@repo/core/lib/site-config";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import type { AccountAuth } from "@repo/backend-sql/account";
import { uniqueViolation } from "@repo/backend-sql/errors";
import { bool, newId, nowIso } from "@repo/backend-sql/values";
import { SESSION_COOKIE_NAME } from "@repo/backend-sqlite/config";
import { getDatabase } from "@repo/backend-sqlite/db";
import { sendEmail } from "@repo/backend-sqlite/email";
import { hashPassword, hashToken, newToken, verifyPassword } from "@repo/backend-sqlite/passwords";

// Built-in auth for the SQLite backend: scrypt password hashes, a random session token in an
// httpOnly cookie (only its hash in the database) and single-use password-reset tokens.

const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 60;
// Invites wait longer than a reset: the new staff member may not read the email at once.
const INVITE_TOKEN_MINUTES = 7 * 24 * 60;
const DAY_MS = 86_400_000;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
} as const;

async function startSession(user_id: string) {
  const { token, hash } = newToken();
  await getDatabase()
    .insertInto("auth_sessions")
    .values({ token_hash: hash, user_id, expires_at: new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString() })
    .execute();
  (await cookies()).set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
}

async function findUserByEmail(email: string) {
  return getDatabase()
    .selectFrom("users")
    .leftJoin("auth_credentials", "auth_credentials.user_id", "users.id")
    .select(["users.id", "auth_credentials.password_hash"])
    .where("users.email", "=", email.toLowerCase())
    .executeTakeFirst();
}

// A single-use password link. Invites and resets use the same token purpose, so the
// new-password page handles both.
async function issuePasswordToken(user_id: string, minutes: number): Promise<string> {
  const { token, hash } = newToken();
  await getDatabase()
    .insertInto("auth_tokens")
    .values({
      token_hash: hash,
      user_id,
      purpose: "password_reset",
      expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
    })
    .execute();
  return token;
}

// The session from the cookie, checked against the database. Cached per request.
const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const row = await getDatabase()
    .selectFrom("auth_sessions")
    .innerJoin("users", "users.id", "auth_sessions.user_id")
    .select(["users.id", "users.email", "users.name", "users.phone", "users.verified", "auth_sessions.expires_at"])
    .where("auth_sessions.token_hash", "=", hashToken(token))
    .executeTakeFirst();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: row.id, email: row.email, name: row.name, phone: row.phone, verified: bool(row.verified) };
});

export const sqlite_auth: AuthBackend & AccountAuth = {
  getCurrentUser,

  async signIn(email, password) {
    const user = await findUserByEmail(email);
    // Same error whether the account exists or not.
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      throw new BackendError("invalid_credentials");
    }
    await startSession(user.id);
  },

  async signUp({ name, email, password }) {
    const db = getDatabase();
    const id = newId();
    const password_hash = await hashPassword(password);
    try {
      await db.transaction().execute(async (trx) => {
        await trx.insertInto("users").values({ id, email: email.toLowerCase(), name }).execute();
        await trx.insertInto("auth_credentials").values({ user_id: id, password_hash }).execute();
      });
    } catch (error) {
      if (uniqueViolation(error)?.includes("email")) throw new BackendError("email_taken");
      throw error;
    }
    await startSession(id);
  },

  async signOut() {
    const cookie_store = await cookies();
    const token = cookie_store.get(SESSION_COOKIE_NAME)?.value;
    if (token) await getDatabase().deleteFrom("auth_sessions").where("token_hash", "=", hashToken(token)).execute();
    cookie_store.delete(SESSION_COOKIE_NAME);
  },

  // Never reveals whether the account exists: unknown emails just get no message.
  async requestPasswordReset(email) {
    const user = await findUserByEmail(email);
    if (!user) return;
    const token = await issuePasswordToken(user.id, RESET_TOKEN_MINUTES);
    // No locale in the link: the proxy sends the visitor to their language and keeps the token.
    const link = `${SITE_URL}/auth/new-password?token=${encodeURIComponent(token)}`;
    const store_name = await getSiteSetting("SITE_NAME");
    await sendEmail({
      to: email,
      subject: `${store_name}: reset your password`,
      text: `Use this link to choose a new password (valid for ${RESET_TOKEN_MINUTES} minutes):\n\n${link}\n\nIf you didn't ask for it, ignore this email.`,
    });
  },

  // An account without credentials can't sign in until the invite link sets a password.
  async ensureUser({ email, name }) {
    const existing = await findUserByEmail(email);
    if (existing) return { user_id: existing.id, is_new: false };
    const id = newId();
    try {
      await getDatabase().insertInto("users").values({ id, email: email.toLowerCase(), name }).execute();
    } catch (error) {
      // Created by a parallel request between the lookup and the insert.
      const user = uniqueViolation(error) ? await findUserByEmail(email) : null;
      if (!user) throw error;
      return { user_id: user.id, is_new: false };
    }
    return { user_id: id, is_new: true };
  },

  async sendStaffInvite(email) {
    const user = await findUserByEmail(email);
    if (!user) throw new BackendError("not_found");
    const token = await issuePasswordToken(user.id, INVITE_TOKEN_MINUTES);
    const link = `${ADMIN_URL}/new-password?token=${encodeURIComponent(token)}`;
    const store_name = await getSiteSetting("SITE_NAME");
    await sendEmail({
      to: email,
      subject: `${store_name}: you've been added to the team`,
      text: `You now have access to the ${store_name} admin. Choose a password with this link (valid for 7 days):\n\n${link}`,
    });
  },

  async confirmPasswordReset(token, password) {
    const db = getDatabase();
    const row = await db
      .selectFrom("auth_tokens")
      .select(["user_id", "expires_at", "used_at"])
      .where("token_hash", "=", hashToken(token))
      .where("purpose", "=", "password_reset")
      .executeTakeFirst();
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) throw new BackendError("invalid_token");

    const password_hash = await hashPassword(password);
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("auth_tokens")
        .set({ used_at: nowIso() })
        .where("token_hash", "=", hashToken(token))
        .execute();
      await trx
        .insertInto("auth_credentials")
        .values({ user_id: row.user_id, password_hash })
        .onConflict((oc) => oc.column("user_id").doUpdateSet({ password_hash, updated_at: nowIso() }))
        .execute();
      // A reset ends every session, including this browser's.
      await trx.deleteFrom("auth_sessions").where("user_id", "=", row.user_id).execute();
    });
    (await cookies()).delete(SESSION_COOKIE_NAME);
  },

  async changePassword(user, old_password, password) {
    const db = getDatabase();
    const credentials = await db
      .selectFrom("auth_credentials")
      .select("password_hash")
      .where("user_id", "=", user.id)
      .executeTakeFirst();
    if (!credentials || !(await verifyPassword(old_password, credentials.password_hash)))
      throw new BackendError("wrong_password");
    const password_hash = await hashPassword(password);
    const current = hashToken((await cookies()).get(SESSION_COOKIE_NAME)?.value ?? "");
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("auth_credentials")
        .set({ password_hash, updated_at: nowIso() })
        .where("user_id", "=", user.id)
        .execute();
      // Other devices are signed out; this one stays signed in.
      await trx.deleteFrom("auth_sessions").where("user_id", "=", user.id).where("token_hash", "!=", current).execute();
    });
  },
};
