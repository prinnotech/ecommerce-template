import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { MetafieldDefinitionRecord, MetafieldsBackend } from "@repo/core/backend/types";
import type { SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import { bool, json, newId, nowIso } from "@repo/backend-sql/values";

export function createMetafields({ db }: SqlContext): MetafieldsBackend {
  return {
    async listDefinitions(owner) {
      let query = db.selectFrom("metafield_definitions").selectAll();
      if (owner) query = query.where("owner", "=", owner);
      const rows = await query.orderBy("position").orderBy("created_at").execute();
      return rows.map((row): MetafieldDefinitionRecord => ({
        id: row.id,
        owner: row.owner,
        key: row.key,
        name: json(row.name, {}),
        description: json(row.description, {}),
        type: row.type,
        is_storefront: bool(row.is_storefront),
        position: Number(row.position),
      }));
    },

    async createDefinition(fields) {
      const id = newId();
      await db
        .insertInto("metafield_definitions")
        .values({ id, ...fields })
        .execute()
        .catch((error: unknown) => {
          if (uniqueViolation(error)) throw new BackendError("metafield_key_taken");
          throw error;
        });
      return { id };
    },

    async updateDefinition(id, fields) {
      const result = await db
        .updateTable("metafield_definitions")
        .set({ ...fields, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async deleteDefinition(id) {
      const result = await db.deleteFrom("metafield_definitions").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },

    async getValues(owner, owner_key) {
      const row = await db
        .selectFrom("metafield_values")
        .select("data")
        .where("owner", "=", owner)
        .where("owner_key", "=", owner_key)
        .executeTakeFirst();
      return row ? json(row.data, {}) : {};
    },

    async setValues(owner, owner_key, values, actor) {
      await db
        .insertInto("metafield_values")
        .values({ id: newId(), owner, owner_key, data: values, updated_by: actor || null })
        .onConflict((conflict) =>
          conflict
            .columns(["owner", "owner_key"])
            .doUpdateSet({ data: values, updated_by: actor || null, updated_at: nowIso() }),
        )
        .execute();
    },
  };
}
