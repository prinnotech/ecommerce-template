import "server-only";

import { z } from "zod";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminDomain, DnsRecord, DomainsBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { DomainsResponse } from "@repo/backend-pocketbase/pocketbase-types";

const dns_records_schema = z.array(z.object({ type: z.string(), name: z.string(), value: z.string() })).catch([]);

function toDomain(record: DomainsResponse<unknown>): AdminDomain {
  return {
    id: record.id,
    hostname: record.hostname,
    target: record.target,
    is_primary: record.is_primary,
    status: record.status,
    dns_records: dns_records_schema.parse(record.dns_records) as DnsRecord[],
    provider_ref: record.provider_ref ?? "",
    last_error: record.last_error ?? "",
    last_checked_at: record.last_checked_at ?? "",
    created_at: record.created_at,
  };
}

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

export const domains: DomainsBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("domains").getFullList({ sort: "target,-is_primary,created_at" });
    return records.map(toDomain);
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("domains")
      .getOne(id)
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) return null;
        throw error;
      });
    return record ? toDomain(record) : null;
  },

  async create(fields) {
    const pb = await createAdminPocketBase();
    try {
      return toDomain(await pb.collection("domains").create({ ...fields, is_primary: false }));
    } catch (error) {
      if (pocketBaseFieldCode(error, "hostname") === "validation_not_unique") throw new BackendError("domain_taken");
      throw error;
    }
  },

  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("domains").update(id, fields).catch(notFound);
  },

  // One batch, so the target never has two primaries.
  async setPrimary(id) {
    const pb = await createAdminPocketBase();
    const domain = await pb.collection("domains").getOne(id, { fields: "id,target" }).catch(notFound);
    const others = await pb.collection("domains").getFullList({
      filter: pb.filter("target = {:target} && is_primary = true && id != {:id}", { target: domain.target, id }),
      fields: "id",
    });
    const batch = pb.createBatch();
    for (const other of others) batch.collection("domains").update(other.id, { is_primary: false });
    batch.collection("domains").update(id, { is_primary: true });
    await batch.send();
  },

  async clearPrimary(target) {
    const pb = await createAdminPocketBase();
    const primaries = await pb.collection("domains").getFullList({
      filter: pb.filter("target = {:target} && is_primary = true", { target }),
      fields: "id",
    });
    if (primaries.length === 0) return;
    const batch = pb.createBatch();
    for (const domain of primaries) batch.collection("domains").update(domain.id, { is_primary: false });
    await batch.send();
  },

  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("domains").delete(id).catch(notFound);
  },
};
