import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { MediaBackend, MediaItem, PageRecord, PagesBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import { getFileUrl } from "@repo/backend-pocketbase/files";
import type { MediaResponse, PagesResponse } from "@repo/backend-pocketbase/pocketbase-types";

function toPage(record: PagesResponse<unknown, unknown, unknown>): PageRecord {
  return {
    id: record.id,
    title: record.title ?? {},
    slug: record.slug,
    sections: record.sections ?? [],
    seo: record.seo ?? {},
    is_published: record.is_published,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

function slugTaken(error: unknown): never {
  if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") throw new BackendError("slug_taken");
  notFound(error);
}

export const pages: PagesBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("pages").getFullList({ sort: "-updated_at" });
    return records.map(toPage);
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("pages")
      .getOne(id)
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) return null;
        throw error;
      });
    return record ? toPage(record) : null;
  },

  async getPublishedBySlug(slug) {
    const pb = await createAdminPocketBase();
    const records = await pb
      .collection("pages")
      .getList(1, 1, { filter: pb.filter("slug = {:slug} && is_published = true", { slug }) });
    const record = records.items[0];
    return record ? toPage(record) : null;
  },

  async create(fields) {
    const pb = await createAdminPocketBase();
    try {
      return toPage(await pb.collection("pages").create({ ...fields, is_published: false }));
    } catch (error) {
      return slugTaken(error);
    }
  },

  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("pages").update(id, fields).catch(slugTaken);
  },

  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("pages").delete(id).catch(notFound);
  },
};

function toItem(record: MediaResponse): MediaItem {
  return {
    id: record.id,
    url: getFileUrl(record, record.file),
    name: record.name,
    size: record.size,
    created_at: record.created_at,
  };
}

export const media: MediaBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("media").getList(1, 500, { sort: "-created_at" });
    return records.items.map(toItem);
  },

  async upload(file) {
    const pb = await createAdminPocketBase();
    return toItem(await pb.collection("media").create({ file, name: file.name.slice(0, 200), size: file.size }));
  },

  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("media").delete(id).catch(notFound);
  },
};
