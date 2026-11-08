import "server-only";

import { z } from "zod";

import type { DnsRecord } from "@repo/core/backend/types";
import type { DomainTarget } from "@repo/core/lib/schemas/domains";
import { isApex, relativeName, zoneOf } from "@repo/core/lib/hosting/dns-names";
import { HostingError, type HostingCheck, type HostingProvider } from "@repo/core/lib/hosting/types";

// Vercel's REST API: a domain is added to a project; ownership may need a TXT record
// ("verification"), and routing an A record (apex) or CNAME (subdomain). Vercel issues the
// certificate once the configuration is right.
const API = "https://api.vercel.com";
const TIMEOUT_MS = 15_000;
// Vercel's documented defaults, used when the config endpoint gives no recommendation.
const DEFAULT_A = "76.76.21.21";
const DEFAULT_CNAME = "cname.vercel-dns.com";

const project_domain_schema = z.object({
  name: z.string(),
  verified: z.boolean(),
  verification: z.array(z.object({ type: z.string(), domain: z.string(), value: z.string() })).nullish(),
});
const config_schema = z.object({
  misconfigured: z.boolean(),
  recommendedIPv4: z.array(z.object({ rank: z.number(), value: z.array(z.string()) })).nullish(),
  recommendedCNAME: z.array(z.object({ rank: z.number(), value: z.string() })).nullish(),
});

function projectId(target: DomainTarget): string {
  return (target === "admin" ? process.env.VERCEL_ADMIN_PROJECT_ID : process.env.VERCEL_STORE_PROJECT_ID) ?? "";
}

async function call(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = new URL(path, API);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${process.env.HOSTING_API_TOKEN ?? ""}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new HostingError(data.error?.message ?? `Vercel API: HTTP ${response.status}`, {
      cause: data.error?.code,
    });
  }
  return data;
}

async function check(hostname: string, target: DomainTarget): Promise<HostingCheck> {
  const project = encodeURIComponent(projectId(target));
  const domain_path = `/v9/projects/${project}/domains/${encodeURIComponent(hostname)}`;
  let domain = project_domain_schema.parse(await call("GET", domain_path));
  // Ask Vercel to look for the TXT record again; it answers 400 while it's still missing.
  if (!domain.verified) {
    domain = await call("POST", `${domain_path}/verify`)
      .then((data) => project_domain_schema.parse(data))
      .catch(() => domain);
  }
  const config = config_schema.parse(await call("GET", `/v6/domains/${encodeURIComponent(hostname)}/config`));

  const zone = zoneOf(hostname);
  const best = <T extends { rank: number }>(list: T[] | null | undefined) =>
    [...(list ?? [])].sort((a, b) => a.rank - b.rank)[0];
  const records: DnsRecord[] = [
    isApex(hostname)
      ? { type: "A", name: "@", value: best(config.recommendedIPv4)?.value[0] ?? DEFAULT_A }
      : {
          type: "CNAME",
          name: relativeName(hostname, zone),
          value: (best(config.recommendedCNAME)?.value ?? DEFAULT_CNAME).replace(/\.$/, ""),
        },
    ...(domain.verified ? [] : (domain.verification ?? [])).map((item) => ({
      type: item.type,
      name: relativeName(item.domain, zone),
      value: item.value,
    })),
  ];

  if (config.misconfigured) return { status: "pending", dns_records: records, error: "" };
  return { status: domain.verified ? "active" : "verifying", dns_records: records, error: "" };
}

export const vercel_provider: HostingProvider = {
  name: "vercel",

  async attach(hostname, target) {
    try {
      await call("POST", `/v10/projects/${encodeURIComponent(projectId(target))}/domains`, { name: hostname });
    } catch (error) {
      // Already on this project (added by hand, or a retry): carry on and read its state.
      if (!(error instanceof HostingError && error.cause === "domain_already_in_use_by_project")) throw error;
    }
    return { ...(await check(hostname, target)), provider_ref: hostname };
  },

  check: (domain) => check(domain.hostname, domain.target),

  async detach(domain) {
    await call(
      "DELETE",
      `/v9/projects/${encodeURIComponent(projectId(domain.target))}/domains/${encodeURIComponent(domain.hostname)}`,
    );
  },
};

export const VERCEL_ENV = ["HOSTING_API_TOKEN", "VERCEL_STORE_PROJECT_ID", "VERCEL_ADMIN_PROJECT_ID"] as const;
