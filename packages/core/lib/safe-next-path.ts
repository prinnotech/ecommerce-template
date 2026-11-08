// Only same-site paths are allowed as post-login redirects (no "//evil.com" or "/\evil.com").
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
