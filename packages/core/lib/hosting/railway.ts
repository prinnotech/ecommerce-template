import "server-only";

import { z } from "zod";

import type { DnsRecord } from "@repo/core/backend/types";
import type { DomainTarget } from "@repo/core/lib/schemas/domains";
import { isApex, relativeName, zoneOf } from "@repo/core/lib/hosting/dns-names";
import { HostingError, type HostingCheck, type HostingProvider } from "@repo/core/lib/hosting/types";

// Railway's public GraphQL API (docs.railway.com/integrations/api/manage-domains). A custom domain
// belongs to one service in one environment; Railway returns the DNS records to create and their
// status, and issues the certificate once they're valid.
const ENDPOINT = "https://backboard.railway.com/graphql/v2";
const TIMEOUT_MS = 15_000;

// The documented status fields, plus the record type and verification host when the API offers
// them. If the API rejects the extra fields, the query is retried with the documented ones only.
const FULL_STATUS = `status {
  dnsRecords { hostlabel fqdn recordType requiredValue currentValue status zone }
  verificationDnsHost verificationToken certificateStatus
}`;
const BASIC_STATUS = `status {
  dnsRecords { hostlabel requiredValue currentValue status }
  verificationToken certificateStatus
}`;

const status_schema = z.object({
  dnsRecords: z
    .array(
      z.object({
        hostlabel: z.string().nullish(),
        fqdn: z.string().nullish(),
        recordType: z.string().nullish(),
        requiredValue: z.string().nullish(),
        status: z.string().nullish(),
        zone: z.string().nullish(),
      }),
    )
    .nullish(),
  verificationDnsHost: z.string().nullish(),
  verificationToken: z.string().nullish(),
  certificateStatus: z.string().nullish(),
});
const domain_schema = z.object({ id: z.string(), domain: z.string(), status: status_schema.nullish() });
type RailwayStatus = z.infer<typeof status_schema>;

function config() {
  const token = process.env.HOSTING_API_TOKEN ?? "";
  const project_id = process.env.RAILWAY_PROJECT_ID ?? "";
  const environment_id = process.env.RAILWAY_ENVIRONMENT_ID ?? "";
  return { token, project_id, environment_id };
}

function serviceId(target: DomainTarget): string {
  return (target === "admin" ? process.env.RAILWAY_ADMIN_SERVICE_ID : process.env.RAILWAY_STORE_SERVICE_ID) ?? "";
}

async function graphql(query: string, variables: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config().token}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new HostingError(body.errors.map((error) => error.message).join("; "));
  if (!response.ok || !body.data) throw new HostingError(`Railway API: HTTP ${response.status}`);
  return body.data;
}

// Runs the query with the full status fields, falling back to the documented ones.
async function withStatus(build: (status: string) => string, variables: Record<string, unknown>) {
  try {
    return await graphql(build(FULL_STATUS), variables);
  } catch (error) {
    if (error instanceof HostingError && /cannot query field/i.test(error.message)) {
      return graphql(build(BASIC_STATUS), variables);
    }
    throw error;
  }
}

const isValid = (status: string | null | undefined) => /VALID/i.test(status ?? "") && !/INVALID/i.test(status ?? "");

function toCheck(hostname: string, status: RailwayStatus | null | undefined): HostingCheck {
  const zone = zoneOf(hostname);
  const records: DnsRecord[] = (status?.dnsRecords ?? []).map((record) => ({
    // "DNS_RECORD_TYPE_CNAME" → "CNAME"; without a type, a CNAME (ALIAS on an apex) to the target.
    type: record.recordType ? record.recordType.replace(/^DNS_RECORD_TYPE_/, "") : isApex(hostname) ? "ALIAS" : "CNAME",
    name: record.fqdn ? relativeName(record.fqdn, record.zone ?? zone) : record.hostlabel || "@",
    value: record.requiredValue ?? "",
  }));
  if (status?.verificationToken) {
    const host = status.verificationDnsHost ?? `_railway-verify.${hostname}`;
    records.push({ type: "TXT", name: relativeName(host, zone), value: status.verificationToken });
  }

  const certificate = (status?.certificateStatus ?? "").toUpperCase();
  const dns_ok =
    (status?.dnsRecords ?? []).length > 0 && (status?.dnsRecords ?? []).every((record) => isValid(record.status));
  if (certificate.includes("FAILED"))
    return { status: "error", dns_records: records, error: "Certificate issuance failed" };
  if (dns_ok && (certificate.includes("ISSUED") || certificate.includes("VALID"))) {
    return { status: "active", dns_records: records, error: "" };
  }
  return { status: dns_ok ? "verifying" : "pending", dns_records: records, error: "" };
}

export const railway_provider: HostingProvider = {
  name: "railway",

  async attach(hostname, target) {
    const { project_id, environment_id } = config();
    const data = await withStatus(
      (status) =>
        `mutation ($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { id domain ${status} } }`,
      {
        input: { domain: hostname, projectId: project_id, environmentId: environment_id, serviceId: serviceId(target) },
      },
    );
    const created = domain_schema.parse(data.customDomainCreate);
    return { ...toCheck(hostname, created.status), provider_ref: created.id };
  },

  async check(domain) {
    const data = await withStatus(
      (status) =>
        `query ($id: String!, $projectId: String!) { customDomain(id: $id, projectId: $projectId) { id domain ${status} } }`,
      { id: domain.provider_ref, projectId: config().project_id },
    );
    return toCheck(domain.hostname, domain_schema.parse(data.customDomain).status);
  },

  async detach(domain) {
    if (!domain.provider_ref) return;
    await graphql(
      `
        mutation ($id: String!) {
          customDomainDelete(id: $id)
        }
      `,
      { id: domain.provider_ref },
    );
  },
};

// The env names Railway mode needs, for the setup hint on the Domains page.
export const RAILWAY_ENV = [
  "HOSTING_API_TOKEN",
  "RAILWAY_PROJECT_ID",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_STORE_SERVICE_ID",
  "RAILWAY_ADMIN_SERVICE_ID",
] as const;
