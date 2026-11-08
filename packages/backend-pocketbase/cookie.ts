// Shared by the server client and the proxy, so it must not import "server-only".

export const AUTH_COOKIE = "pb_auth";

// PocketBase auth tokens default to 7 days; the cookie lives as long as the token.
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE,
} as const;

// Reads the `exp` claim without verifying it. Only for deciding when to refresh,
// never for deciding who the user is (that is auth.ts, which calls authRefresh).
export function getTokenExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof json === "object" && json !== null && "exp" in json && typeof json.exp === "number") {
      return json.exp;
    }
    return null;
  } catch {
    // Malformed token: treat as expired.
    return null;
  }
}
