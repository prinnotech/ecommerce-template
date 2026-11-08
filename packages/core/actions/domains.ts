"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminDomain } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, type Caller } from "@repo/core/lib/auth";
import { getHostingProvider, HostingError, hostingSetup, type HostingSetup } from "@repo/core/lib/hosting/index";
import {
  add_domain_schema,
  DOMAIN_TARGETS,
  domain_id_schema,
  type AddDomainInput,
  type DomainIdInput,
  type DomainTarget,
} from "@repo/core/lib/schemas/domains";
import { reportError } from "@repo/core/lib/server-log";
import { ADMIN_URL, SITE_URL } from "@repo/core/lib/site-config";

export type { AdminDomain };

export type DomainsOverview = {
  domains: AdminDomain[];
  setup: HostingSetup;
  // Where each app answers today (NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_ADMIN_URL).
  current_hosts: Record<DomainTarget, string>;
};

const PRIMARY_SETTING: Record<DomainTarget, "PRIMARY_DOMAIN_STORE" | "PRIMARY_DOMAIN_ADMIN"> = {
  store: "PRIMARY_DOMAIN_STORE",
  admin: "PRIMARY_DOMAIN_ADMIN",
};

function log(caller: Caller, action: string, domain: Pick<AdminDomain, "id" | "hostname" | "target">) {
  return logActivity({
    actor_id: caller.user_id,
    action,
    target_type: "domains",
    target_id: domain.id,
    details: { hostname: domain.hostname, target: domain.target },
  });
}

// The proxies read these public settings to redirect every other hostname to the primary.
async function savePrimarySetting(caller: Caller, target: DomainTarget, hostname: string) {
  await getBackend().settings.save({
    key: PRIMARY_SETTING[target],
    category: "domains",
    value: hostname,
    is_public: true,
    updated_by: caller.user_id,
  });
}

// The provider's own message goes to the server log; the owner sees a translated error.
async function hostingFailure(error: unknown, context: string) {
  await reportError("domains", context, error);
  return fail("hosting_error");
}

export async function getDomains(): Promise<ActionResult<DomainsOverview>> {
  const auth = await authorize("settings.view", "view domains");
  if (!auth.ok) return auth;

  try {
    return ok({
      domains: await getBackend().domains.list(),
      setup: hostingSetup(),
      current_hosts: { store: new URL(SITE_URL).host, admin: new URL(ADMIN_URL).host },
    });
  } catch (error) {
    return failFrom(error, "domains", "getDomains");
  }
}

// Attaches the domain at the hosting provider first, so a domain the host refuses is never saved.
export async function addDomain(input: AddDomainInput): Promise<ActionResult<AdminDomain>> {
  const auth = await authorize("settings.edit", "add a domain");
  if (!auth.ok) return auth;
  const parsed = add_domain_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { hostname, target } = parsed.data;

  try {
    const backend = getBackend();
    if ((await backend.domains.list()).some((domain) => domain.hostname === hostname)) return fail("domain_taken");

    let attached;
    try {
      attached = await getHostingProvider().attach(hostname, target);
    } catch (error) {
      if (error instanceof HostingError) return hostingFailure(error, `addDomain ${hostname}`);
      throw error;
    }

    const domain = await backend.domains.create({
      hostname,
      target,
      status: attached.status,
      dns_records: attached.dns_records,
      provider_ref: attached.provider_ref,
      last_error: attached.error,
    });
    await log(auth.caller, "add a domain", domain);
    return ok(domain);
  } catch (error) {
    return failFrom(error, "domains", "addDomain");
  }
}

// Asks the provider (or DNS, in manual mode) where the domain stands and stores the answer.
// Read-only roles (the demo) get the stored state: refreshing writes to the database.
export async function checkDomain(input: DomainIdInput): Promise<ActionResult<AdminDomain>> {
  const auth = await authorize("settings.view", "check a domain");
  if (!auth.ok) return auth;
  const parsed = domain_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const domain = await backend.domains.get(parsed.data.id);
    if (!domain) return fail("not_found");
    if (auth.caller.is_read_only) return ok(domain);

    const checked_at = new Date().toISOString();
    try {
      const result = await getHostingProvider().check(domain);
      await backend.domains.update(domain.id, {
        status: result.status,
        dns_records: result.dns_records.length > 0 ? result.dns_records : domain.dns_records,
        last_error: result.error,
        last_checked_at: checked_at,
      });
    } catch (error) {
      if (!(error instanceof HostingError)) throw error;
      // Kept on the row so the owner sees why, without losing the records shown before.
      await backend.domains.update(domain.id, {
        status: "error",
        last_error: error.message,
        last_checked_at: checked_at,
      });
    }
    const updated = await backend.domains.get(domain.id);
    return updated ? ok(updated) : fail("not_found");
  } catch (error) {
    return failFrom(error, "domains", "checkDomain");
  }
}

export async function setPrimaryDomain(input: DomainIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "set the primary domain");
  if (!auth.ok) return auth;
  const parsed = domain_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const domain = await backend.domains.get(parsed.data.id);
    if (!domain) return fail("not_found");
    // Redirecting everyone to a domain that doesn't answer yet would take the app offline.
    if (domain.status !== "active") return fail("domain_not_active");

    await backend.domains.setPrimary(domain.id);
    await savePrimarySetting(auth.caller, domain.target, domain.hostname);
    await log(auth.caller, "set the primary domain", domain);
    return ok(null);
  } catch (error) {
    return failFrom(error, "domains", "setPrimaryDomain");
  }
}

// Stops redirecting the app's other addresses.
export async function clearPrimaryDomain(input: { target: DomainTarget }): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "clear the primary domain");
  if (!auth.ok) return auth;
  if (!DOMAIN_TARGETS.includes(input?.target)) return fail("invalid_input");

  try {
    await getBackend().domains.clearPrimary(input.target);
    await savePrimarySetting(auth.caller, input.target, "");
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "clear the primary domain",
      target_type: "domains",
      details: { target: input.target },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "domains", "clearPrimaryDomain");
  }
}

export async function removeDomain(input: DomainIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "remove a domain");
  if (!auth.ok) return auth;
  const parsed = domain_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const domain = await backend.domains.get(parsed.data.id);
    if (!domain) return fail("not_found");
    if (domain.is_primary) return fail("primary_domain");

    try {
      await getHostingProvider().detach(domain);
    } catch (error) {
      if (error instanceof HostingError) return hostingFailure(error, `removeDomain ${domain.hostname}`);
      throw error;
    }
    await backend.domains.remove(domain.id);
    await log(auth.caller, "remove a domain", domain);
    return ok(null);
  } catch (error) {
    return failFrom(error, "domains", "removeDomain");
  }
}
