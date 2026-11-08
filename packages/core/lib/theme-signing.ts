import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Signed messages between the admin and the store, with THEME_PREVIEW_SECRET (server only, set in
// both apps):
// - preview tokens: the admin's editor loads /{lang}/theme-preview/{token} in an iframe, and only a
//   valid, unexpired token shows that theme's draft;
// - revalidation requests: the admin tells the store to refresh its pages after a publish.
// Each kind has its own prefix, so a signature for one can't be replayed as the other.

const PREVIEW_TTL_MS = 2 * 60 * 60_000;
const REVALIDATE_TTL_MS = 5 * 60_000;

function secret(): string {
  return process.env.THEME_PREVIEW_SECRET ?? "";
}

export function hasSigningSecret(): boolean {
  return secret().length >= 16;
}

function sign(message: string): string {
  return createHmac("sha256", secret()).update(message).digest("base64url");
}

function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createPreviewToken(theme_id: string, now = Date.now()): string | null {
  if (!hasSigningSecret()) return null;
  const expires = now + PREVIEW_TTL_MS;
  return `${theme_id}.${expires}.${sign(`preview:${theme_id}:${expires}`)}`;
}

// The theme id the token was made for, or null (bad signature, expired, no secret).
export function verifyPreviewToken(token: string, now = Date.now()): string | null {
  if (!hasSigningSecret()) return null;
  const [theme_id, expires, signature] = token.split(".");
  if (!theme_id || !expires || !signature) return null;
  if (!/^\d+$/.test(expires) || Number(expires) < now) return null;
  return sameSignature(signature, sign(`preview:${theme_id}:${expires}`)) ? theme_id : null;
}

export function revalidateHeaders(now = Date.now()): Record<string, string> | null {
  if (!hasSigningSecret()) return null;
  const timestamp = String(now);
  return { "x-revalidate-timestamp": timestamp, "x-revalidate-signature": sign(`revalidate:${timestamp}`) };
}

export function verifyRevalidateHeaders(timestamp: string | null, signature: string | null, now = Date.now()): boolean {
  if (!hasSigningSecret() || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > REVALIDATE_TTL_MS) return false;
  return sameSignature(signature, sign(`revalidate:${timestamp}`));
}
