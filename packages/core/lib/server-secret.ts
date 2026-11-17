import "server-only";

import { hkdfSync, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { sqlitePath } from "@repo/backend-sqlite/config";
import { BACKEND_NAME } from "@repo/core/backend/index";

// Server-side keys the store and the admin must share (theme preview signing, settings
// encryption). Each one comes from its own env variable when that's set (16+ characters);
// otherwise it's derived with HKDF from a secret both apps already have for the backend, so a
// fresh deployment works without extra configuration:
// - pocketbase: POCKETBASE_SUPERUSER_PASSWORD
// - supabase:   SUPABASE_SECRET_KEY
// - sqlite:     a random key file next to the database (both apps share that folder)
// Changing the backend secret later changes the derived keys: stored secrets then need to be
// typed again, which docs/deploy.md mentions.

export type ServerSecretPurpose = "THEME_PREVIEW_SECRET" | "SETTINGS_ENCRYPTION_KEY";

const MIN_LENGTH = 16;

function sqliteKeyFile(): string {
  const key_file = path.join(path.dirname(sqlitePath()), ".server-key");
  try {
    return readFileSync(key_file, "utf8").trim();
  } catch {
    // Not created yet: create it. "wx" fails if the other app created it in the meantime,
    // in which case its value is read back.
    mkdirSync(path.dirname(key_file), { recursive: true });
    try {
      writeFileSync(key_file, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 });
    } catch {
      // Created by the other app between the read and the write.
    }
    return readFileSync(key_file, "utf8").trim();
  }
}

function rootSecret(): string {
  switch (BACKEND_NAME) {
    case "pocketbase":
      return process.env.POCKETBASE_SUPERUSER_PASSWORD ?? "";
    case "supabase":
      return process.env.SUPABASE_SECRET_KEY ?? "";
    case "sqlite":
      return sqliteKeyFile();
    default:
      return "";
  }
}

const cached = new Map<ServerSecretPurpose, string>();

// "" when neither the env variable nor a backend secret is available.
export function serverSecret(purpose: ServerSecretPurpose): string {
  const from_env = process.env[purpose] ?? "";
  if (from_env.length >= MIN_LENGTH) return from_env;
  const hit = cached.get(purpose);
  if (hit !== undefined) return hit;
  const root = rootSecret();
  const derived =
    root.length >= 8
      ? Buffer.from(hkdfSync("sha256", root, "storefront-template", purpose, 32)).toString("base64url")
      : "";
  cached.set(purpose, derived);
  return derived;
}
