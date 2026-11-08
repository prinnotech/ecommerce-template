import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { z } from "zod";

import { getBackend } from "@repo/core/backend/index";
import { reportError } from "@repo/core/lib/server-log";

// Secrets an owner enters in Settings (the Stripe keys, the SMTP password). They're stored as
// private site_settings rows, encrypted with AES-256-GCM under SETTINGS_ENCRYPTION_KEY (server
// env, never in the database), and never sent to the browser: the admin only learns whether
// each one is set. An environment variable with the same name wins over the stored value, for
// hosts that prefer to keep secrets in env.

export const SECRET_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SMTP_PASSWORD", "META_CAPI_TOKEN"] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

const CATEGORY = "secrets";
const stored_schema = z.object({ v: z.literal(1), iv: z.string(), tag: z.string(), data: z.string() });

function encryptionKey(): Buffer | null {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY ?? "";
  if (secret.length < 16) return null;
  // Any text of 16+ characters works: it's hashed into a 256-bit key.
  return createHash("sha256").update(secret).digest();
}

export function canStoreSecrets(): boolean {
  return encryptionKey() !== null;
}

function encrypt(plain: string, key: Buffer): z.infer<typeof stored_schema> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

function decrypt(stored: z.infer<typeof stored_schema>, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(stored.data, "base64")), decipher.final()]).toString("utf8");
}

// Every stored secret, decrypted, once per request.
const storedSecrets = cache(async (): Promise<Partial<Record<SecretKey, string>>> => {
  const key = encryptionKey();
  if (!key) return {};
  try {
    const rows = await getBackend().settings.list();
    const result: Partial<Record<SecretKey, string>> = {};
    for (const name of SECRET_KEYS) {
      const parsed = stored_schema.safeParse(rows.find((row) => row.key === name)?.value);
      if (!parsed.success) continue;
      try {
        result[name] = decrypt(parsed.data, key);
      } catch (error) {
        // Wrong SETTINGS_ENCRYPTION_KEY (changed after saving): treat it as not set.
        await reportError("secrets", `decrypt ${name}`, error);
      }
    }
    return result;
  } catch (error) {
    await reportError("secrets", "storedSecrets", error);
    return {};
  }
});

export async function getSecret(name: SecretKey): Promise<string> {
  const from_env = process.env[name];
  if (from_env) return from_env;
  return (await storedSecrets())[name] ?? "";
}

export type SecretStatus = { is_set: boolean; is_from_env: boolean };

export async function secretStatus(): Promise<Record<SecretKey, SecretStatus>> {
  const stored = await storedSecrets();
  return Object.fromEntries(
    SECRET_KEYS.map((name) => [
      name,
      { is_set: Boolean(process.env[name] || stored[name]), is_from_env: Boolean(process.env[name]) },
    ]),
  ) as Record<SecretKey, SecretStatus>;
}

// "" removes the secret. Callers authorize first (settings.edit).
export async function saveSecret(name: SecretKey, value: string, updated_by: string): Promise<void> {
  const settings = getBackend().settings;
  if (!value) {
    await settings.remove(name);
    return;
  }
  const key = encryptionKey();
  if (!key) throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
  await settings.save({ key: name, category: CATEGORY, value: encrypt(value, key), is_public: false, updated_by });
}
