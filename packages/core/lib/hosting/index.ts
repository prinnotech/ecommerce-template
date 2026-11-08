import "server-only";

import { manual_provider } from "@repo/core/lib/hosting/manual";
import { RAILWAY_ENV, railway_provider } from "@repo/core/lib/hosting/railway";
import type { HostingProvider, HostingProviderName } from "@repo/core/lib/hosting/types";
import { VERCEL_ENV, vercel_provider } from "@repo/core/lib/hosting/vercel";

export { HostingError } from "@repo/core/lib/hosting/types";

// Which host attaches domains, from HOSTING_PROVIDER (railway | vercel; anything else = manual).
// A provider with missing env vars falls back to manual mode, so the page still works.
export type HostingSetup = { provider: HostingProviderName; requested: string; missing_env: string[] };

const REQUIRED_ENV: Record<"railway" | "vercel", readonly string[]> = { railway: RAILWAY_ENV, vercel: VERCEL_ENV };

export function hostingSetup(): HostingSetup {
  const requested = (process.env.HOSTING_PROVIDER ?? "").trim().toLowerCase();
  if (requested !== "railway" && requested !== "vercel") return { provider: "manual", requested, missing_env: [] };
  const missing_env = REQUIRED_ENV[requested].filter((name) => !process.env[name]);
  return { provider: missing_env.length > 0 ? "manual" : requested, requested, missing_env };
}

export function getHostingProvider(): HostingProvider {
  const { provider } = hostingSetup();
  if (provider === "railway") return railway_provider;
  if (provider === "vercel") return vercel_provider;
  return manual_provider;
}
