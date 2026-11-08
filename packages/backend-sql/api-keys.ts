import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { ApiKeysBackend } from "@repo/core/backend/types";
import type { SqlContext } from "@repo/backend-sql/context";
import { bool, iso, newId, nowIso } from "@repo/backend-sql/values";

export function createApiKeys({ db }: SqlContext): ApiKeysBackend {
  return {
    async list() {
      const rows = await db
        .selectFrom("api_keys")
        .leftJoin("users", "users.id", "api_keys.user_id")
        .select([
          "api_keys.id",
          "api_keys.name",
          "api_keys.key_prefix",
          "api_keys.user_id",
          "api_keys.last_used_at",
          "api_keys.revoked_at",
          "api_keys.created_at",
          "users.email as user_email",
        ])
        .orderBy("api_keys.created_at", "desc")
        .execute();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        key_prefix: row.key_prefix,
        user_id: row.user_id,
        user_email: row.user_email ?? "",
        last_used_at: row.last_used_at ? iso(row.last_used_at) : null,
        revoked_at: row.revoked_at ? iso(row.revoked_at) : null,
        created_at: iso(row.created_at),
      }));
    },

    async create(input) {
      const id = newId();
      await db
        .insertInto("api_keys")
        .values({ id, ...input })
        .execute();
      return { id };
    },

    async revoke(id) {
      const result = await db
        .updateTable("api_keys")
        .set({ revoked_at: nowIso(), updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async findActive(key_hash) {
      const row = await db
        .selectFrom("api_keys")
        .innerJoin("users", "users.id", "api_keys.user_id")
        .select(["api_keys.id", "users.id as user_id", "users.email", "users.name", "users.phone", "users.verified"])
        .where("api_keys.key_hash", "=", key_hash)
        .where("api_keys.revoked_at", "is", null)
        .executeTakeFirst();
      if (!row) return null;
      return {
        id: row.id,
        user: {
          id: row.user_id,
          email: row.email,
          name: row.name ?? "",
          phone: row.phone ?? "",
          verified: bool(row.verified),
        },
      };
    },

    async touch(id) {
      await db.updateTable("api_keys").set({ last_used_at: nowIso() }).where("id", "=", id).execute();
    },
  };
}
