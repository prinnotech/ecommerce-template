import "server-only";

import { z } from "zod";

import { BackendError } from "@repo/core/backend/errors";
import type { ThemeRecord, ThemesBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { ThemesResponse } from "@repo/backend-pocketbase/pocketbase-types";

const history_schema = z.array(z.object({ published_at: z.string(), data: z.unknown() })).catch([]);

// PocketBase stores an empty json field as null (or "" in older records).
function jsonOrNull(value: unknown): unknown {
  return value === "" || value === undefined ? null : value;
}

function toTheme(record: ThemesResponse<unknown, unknown, unknown>): ThemeRecord {
  return {
    id: record.id,
    name: record.name,
    template: record.template,
    draft: jsonOrNull(record.draft),
    published: jsonOrNull(record.published),
    history: history_schema.parse(record.history ?? []).map((item) => ({
      published_at: item.published_at,
      data: item.data,
    })),
    is_live: record.is_live,
    published_at: record.published_at ?? "",
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

export const themes: ThemesBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("themes").getFullList({ sort: "-is_live,-updated_at" });
    return records.map(toTheme);
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("themes")
      .getOne(id)
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) return null;
        throw error;
      });
    return record ? toTheme(record) : null;
  },

  async getLive() {
    const pb = await createAdminPocketBase();
    const records = await pb
      .collection("themes")
      .getList(1, 1, { filter: "is_live = true", fields: "template,published" });
    const record = records.items[0];
    return record ? { template: record.template, published: jsonOrNull(record.published) } : null;
  },

  async create(fields) {
    const pb = await createAdminPocketBase();
    return toTheme(await pb.collection("themes").create({ ...fields, history: [], is_live: false }));
  },

  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("themes").update(id, fields).catch(notFound);
  },

  // One batch, so the store never has two live themes.
  async setLive(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("themes").getOne(id, { fields: "id" }).catch(notFound);
    const others = await pb.collection("themes").getFullList({
      filter: pb.filter("is_live = true && id != {:id}", { id }),
      fields: "id",
    });
    const batch = pb.createBatch();
    for (const other of others) batch.collection("themes").update(other.id, { is_live: false });
    batch.collection("themes").update(id, { is_live: true });
    await batch.send();
  },

  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("themes").delete(id).catch(notFound);
  },
};
