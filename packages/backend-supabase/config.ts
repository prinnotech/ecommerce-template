// Supabase settings (BACKEND=supabase). Shared by the server code and the proxy, so no "server-only".
//   NEXT_PUBLIC_SUPABASE_URL              https://<project>.supabase.co
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  publishable (anon) key: sessions and auth calls
//   SUPABASE_SECRET_KEY                   secret (service role) key: admin auth and storage. Server only.
//   DATABASE_URL                          Postgres connection string (Supabase "Connect" → pooler). Server only.
//   SUPABASE_IMAGE_TRANSFORMS             "true" on plans with image transformations (resized thumbnails)

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const MEDIA_BUCKET = "media";
export const HAS_IMAGE_TRANSFORMS = process.env.SUPABASE_IMAGE_TRANSFORMS === "true";

// Supabase's session cookies are "sb-<project-ref>-auth-token" (split into .0, .1… when large).
export function isSessionCookie(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}
