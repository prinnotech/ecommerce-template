import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminDomain, DnsRecord, DomainsBackend } from "@repo/core/backend/types";
import type { DomainStatus, DomainTarget } from "@repo/core/lib/schemas/domains";
import type { SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

const COLUMNS = [
  "id",
  "hostname",
  "target",
  "is_primary",
  "status",
  "dns_records",
  "provider_ref",
  "last_error",
  "last_checked_at",
  "created_at",
] as const;

function toDomain(row: Record<(typeof COLUMNS)[number], unknown>): AdminDomain {
  return {
    id: String(row.id),
    hostname: String(row.hostname),
    target: row.target as DomainTarget,
    is_primary: bool(row.is_primary),
    status: row.status as DomainStatus,
    dns_records: json<DnsRecord[]>(row.dns_records, []),
    provider_ref: String(row.provider_ref ?? ""),
    last_error: String(row.last_error ?? ""),
    last_checked_at: row.last_checked_at ? iso(String(row.last_checked_at)) : "",
    created_at: iso(String(row.created_at)),
  };
}

export function createDomains({ db }: SqlContext): DomainsBackend {
  async function get(id: string) {
    const row = await db
      .selectFrom("domains")
      .select([...COLUMNS])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  return {
    async list() {
      const rows = await db
        .selectFrom("domains")
        .select([...COLUMNS])
        .orderBy("target")
        .orderBy("is_primary", "desc")
        .orderBy("created_at")
        .execute();
      return rows.map(toDomain);
    },

    get,

    async create(fields) {
      const id = newId();
      try {
        await db
          .insertInto("domains")
          .values({ id, ...fields, is_primary: false })
          .execute();
      } catch (error) {
        if (uniqueViolation(error)) throw new BackendError("domain_taken");
        throw error;
      }
      const created = await get(id);
      if (!created) throw new Error("domain disappeared after insert");
      return created;
    },

    async update(id, fields) {
      const result = await db
        .updateTable("domains")
        .set({ ...fields, last_checked_at: fields.last_checked_at || undefined, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    // One transaction, so there's never a moment with two primaries (or none) for a target.
    async setPrimary(id) {
      await db.transaction().execute(async (trx) => {
        const domain = await trx.selectFrom("domains").select(["target"]).where("id", "=", id).executeTakeFirst();
        if (!domain) throw new BackendError("not_found");
        await trx
          .updateTable("domains")
          .set({ is_primary: false, updated_at: nowIso() })
          .where("target", "=", domain.target)
          .where("id", "!=", id)
          .execute();
        await trx.updateTable("domains").set({ is_primary: true, updated_at: nowIso() }).where("id", "=", id).execute();
      });
    },

    async clearPrimary(target) {
      await db
        .updateTable("domains")
        .set({ is_primary: false, updated_at: nowIso() })
        .where("target", "=", target)
        .execute();
    },

    async remove(id) {
      const result = await db.deleteFrom("domains").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },
  };
}
