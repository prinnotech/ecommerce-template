import "server-only";

import { promises as dns } from "node:dns";
import { isIPv4 } from "node:net";

import type { DnsRecord } from "@repo/core/backend/types";
import type { DomainTarget } from "@repo/core/lib/schemas/domains";
import { isApex, relativeName, zoneOf } from "@repo/core/lib/hosting/dns-names";
import type { HostingCheck, HostingProvider } from "@repo/core/lib/hosting/types";

// No hosting token: the owner adds the domain in the host's dashboard themselves; here the domain
// is recorded, the records to create are shown, and "active" means DNS already points at the app.
// The target is the app's hostname on any host (Render, Fly, Netlify, Coolify…) or, for a server
// of your own, its IPv4 address.

function targetHost(target: DomainTarget): string {
  const host = target === "admin" ? process.env.HOSTING_ADMIN_TARGET_HOST : process.env.HOSTING_STORE_TARGET_HOST;
  return (host ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function recordsFor(hostname: string, target: DomainTarget): DnsRecord[] {
  const host = targetHost(target);
  if (!host) return [];
  const name = relativeName(hostname, zoneOf(hostname));
  if (isIPv4(host)) return [{ type: "A", name, value: host }];
  // Apex domains can't have a CNAME: most registrars offer ALIAS/ANAME (or CNAME flattening).
  return [{ type: isApex(hostname) ? "ALIAS" : "CNAME", name, value: host }];
}

async function resolves(hostname: string, host: string): Promise<boolean> {
  if (isIPv4(host)) return (await dns.resolve4(hostname).catch(() => [] as string[])).includes(host);
  const cnames = await dns.resolveCname(hostname).catch(() => [] as string[]);
  if (cnames.some((name) => name.toLowerCase().replace(/\.$/, "") === host)) return true;
  // ALIAS / flattened records answer with the target's addresses.
  const [mine, theirs] = await Promise.all([
    dns.resolve4(hostname).catch(() => [] as string[]),
    dns.resolve4(host).catch(() => [] as string[]),
  ]);
  return mine.length > 0 && mine.some((address) => theirs.includes(address));
}

async function check(hostname: string, target: DomainTarget): Promise<HostingCheck> {
  const host = targetHost(target);
  const dns_records = recordsFor(hostname, target);
  if (!host) return { status: "pending", dns_records, error: "" };
  return { status: (await resolves(hostname, host)) ? "active" : "pending", dns_records, error: "" };
}

export const manual_provider: HostingProvider = {
  name: "manual",
  async attach(hostname, target) {
    return { ...(await check(hostname, target)), provider_ref: "" };
  },
  check: (domain) => check(domain.hostname, domain.target),
  // Nothing was attached anywhere.
  async detach() {},
};
