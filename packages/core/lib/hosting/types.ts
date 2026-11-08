import type { DnsRecord } from "@repo/core/backend/types";
import type { DomainStatus, DomainTarget } from "@repo/core/lib/schemas/domains";

// Where a domain stands at the hosting provider, and the DNS records the owner must create.
export type HostingCheck = { status: DomainStatus; dns_records: DnsRecord[]; error: string };
export type HostingAttach = HostingCheck & { provider_ref: string };

export type HostedDomain = { hostname: string; target: DomainTarget; provider_ref: string };

// One per hosting provider (Railway, Vercel) plus manual mode. Methods throw HostingError with
// the provider's message when it refuses (shown to the owner on the domain's row).
export type HostingProvider = {
  name: HostingProviderName;
  attach(hostname: string, target: DomainTarget): Promise<HostingAttach>;
  check(domain: HostedDomain): Promise<HostingCheck>;
  detach(domain: HostedDomain): Promise<void>;
};

export type HostingProviderName = "railway" | "vercel" | "manual";

export class HostingError extends Error {}
