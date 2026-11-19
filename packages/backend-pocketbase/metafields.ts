import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { MetafieldDefinitionRecord, MetafieldsBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { MetafieldDefinitionsResponse } from "@repo/backend-pocketbase/pocketbase-types";

// Both collections are locked (null rules): only the server reads and writes them.

function toDefinition(record: MetafieldDefinitionsResponse): MetafieldDefinitionRecord {
  return {
    id: record.id,
    owner: record.owner,
    key: record.key,
    name: record.name ?? {},
    description: record.description ?? {},
    type: record.type,
    is_storefront: record.is_storefront,
    position: record.position,
  };
}

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

export const metafields: MetafieldsBackend = {
  async listDefinitions(owner) {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("metafield_definitions").getFullList({
      sort: "position,created_at",
      ...(owner ? { filter: pb.filter("owner = {:owner}", { owner }) } : {}),
    });
    return records.map(toDefinition);
  },

  async createDefinition(fields) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("metafield_definitions")
      .create(fields)
      .catch((error: unknown) => {
        // The unique index is on (owner, key): PocketBase reports it on either field.
        if (
          pocketBaseFieldCode(error, "key") === "validation_not_unique" ||
          pocketBaseFieldCode(error, "owner") === "validation_not_unique"
        ) {
          throw new BackendError("metafield_key_taken");
        }
        throw error;
      });
    return { id: record.id };
  },

  async updateDefinition(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("metafield_definitions").update(id, fields).catch(notFound);
  },

  async deleteDefinition(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("metafield_definitions").delete(id).catch(notFound);
  },

  async getValues(owner, owner_key) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("metafield_values").getList(1, 1, {
      filter: pb.filter("owner = {:owner} && owner_key = {:owner_key}", { owner, owner_key }),
    });
    return result.items[0]?.data ?? {};
  },

  async setValues(owner, owner_key, values, actor) {
    const pb = await createAdminPocketBase();
    const existing = await pb.collection("metafield_values").getList(1, 1, {
      filter: pb.filter("owner = {:owner} && owner_key = {:owner_key}", { owner, owner_key }),
      fields: "id",
    });
    const id = existing.items[0]?.id;
    if (id) await pb.collection("metafield_values").update(id, { data: values, updated_by: actor });
    else await pb.collection("metafield_values").create({ owner, owner_key, data: values, updated_by: actor });
  },
};
