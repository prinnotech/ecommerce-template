import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminCollection, CollectionsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import {
  EMPTY_RULES,
  rules_schema,
  type CollectionInput,
  type CollectionKind,
  type CollectionSort,
} from "@repo/core/lib/schemas/collections";
import { parseSeo } from "@repo/core/lib/schemas/seo";
import { createAdminPocketBase, createPublicPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { CollectionsResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

type CollectionRecord = CollectionsResponse<unknown, unknown, unknown, unknown>;

function rethrow(error: unknown): never {
  if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") throw new BackendError("slug_taken");
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

function fieldsOf(input: CollectionInput) {
  return {
    title: input.title,
    slug: input.slug,
    description: input.description,
    image_url: input.image_url,
    kind: input.kind,
    rules: input.kind === "automatic" ? input.rules : null,
    sort: input.sort,
    is_published: input.is_published,
    seo: input.seo,
  };
}

function toCollection(record: CollectionRecord, product_ids: string[]): AdminCollection {
  return {
    id: record.id,
    title: (record.title as LocalizedText | null) ?? {},
    slug: record.slug,
    description: (record.description as LocalizedText | null) ?? {},
    image_url: record.image_url,
    kind: record.kind as CollectionKind,
    rules: rules_schema.catch(EMPTY_RULES).parse(record.rules ?? EMPTY_RULES),
    sort: record.sort as CollectionSort,
    is_published: record.is_published,
    seo: parseSeo(record.seo),
    sort_order: record.sort_order,
    product_ids,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

async function productIds(pb: TypedPocketBase, collection_ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (collection_ids.length === 0) return map;
  const rows = await pb.collection("collection_products").getFullList({
    filter: collection_ids
      .map((id, index) => pb.filter(`collection = {:c${index}}`, { [`c${index}`]: id }))
      .join(" || "),
    sort: "position",
    fields: "collection,product",
  });
  for (const row of rows) map.set(row.collection, [...(map.get(row.collection) ?? []), row.product]);
  return map;
}

async function publishedOne(filter: (pb: TypedPocketBase) => string): Promise<AdminCollection | null> {
  const pb = createPublicPocketBase();
  const result = await pb
    .collection("collections")
    .getList<CollectionRecord>(1, 1, { filter: filter(pb), skipTotal: true });
  const record = result.items[0];
  if (!record) return null;
  return toCollection(record, (await productIds(pb, [record.id])).get(record.id) ?? []);
}

export const collections: CollectionsBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("collections").getFullList<CollectionRecord>({ sort: "sort_order,created_at" });
    const ids = await productIds(
      pb,
      records.map((record) => record.id),
    );
    return records.map((record) => toCollection(record, ids.get(record.id) ?? []));
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("collections").getOne<CollectionRecord>(id).catch(rethrow);
    return toCollection(record, (await productIds(pb, [id])).get(id) ?? []);
  },

  async create(input) {
    const pb = await createAdminPocketBase();
    const last = await pb
      .collection("collections")
      .getList<CollectionRecord>(1, 1, { sort: "-sort_order", fields: "sort_order", skipTotal: true });
    const record = await pb
      .collection("collections")
      .create({ ...fieldsOf(input), sort_order: (last.items[0]?.sort_order ?? 0) + 1 })
      .catch(rethrow);
    return { id: record.id };
  },

  async update(id, input) {
    const pb = await createAdminPocketBase();
    await pb.collection("collections").update(id, fieldsOf(input)).catch(rethrow);
  },

  async delete(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("collections").delete(id).catch(rethrow);
  },

  async setProducts(id, product_ids) {
    const pb = await createAdminPocketBase();
    await pb.collection("collections").getOne(id, { fields: "id" }).catch(rethrow);
    const existing = await pb.collection("collection_products").getFullList({
      filter: pb.filter("collection = {:id}", { id }),
      fields: "id",
    });
    // One batch: the old list goes and the new one comes in together.
    const batch = pb.createBatch();
    for (const row of existing) batch.collection("collection_products").delete(row.id);
    [...new Set(product_ids)].forEach((product_id, position) =>
      batch.collection("collection_products").create({ collection: id, product: product_id, position }),
    );
    batch.collection("collections").update(id, {});
    await batch.send();
  },

  async published(slug) {
    return publishedOne((pb) => pb.filter("slug = {:slug}", { slug }));
  },

  async publishedById(id) {
    return publishedOne((pb) => pb.filter("id = {:id}", { id }));
  },

  async publishedSlugs() {
    const pb = createPublicPocketBase();
    return pb.collection("collections").getFullList({ fields: "slug,updated_at" });
  },
};
