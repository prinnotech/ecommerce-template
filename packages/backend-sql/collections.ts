import "server-only";

import type { Selectable } from "kysely";

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
import type { SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import type { CollectionsTable } from "@repo/backend-sql/schema";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

function slugTaken(error: unknown): never {
  if (uniqueViolation(error)?.includes("slug")) throw new BackendError("slug_taken");
  throw error;
}

function columns(input: CollectionInput) {
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

export function createCollections(ctx: SqlContext): CollectionsBackend {
  const { db } = ctx;

  async function productIds(collection_ids: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (collection_ids.length === 0) return map;
    const rows = await db
      .selectFrom("collection_products")
      .select(["collection_id", "product_id"])
      .where("collection_id", "in", collection_ids)
      .orderBy("position")
      .execute();
    for (const row of rows) map.set(row.collection_id, [...(map.get(row.collection_id) ?? []), row.product_id]);
    return map;
  }

  function toCollection(row: Selectable<CollectionsTable>, product_ids: string[]): AdminCollection {
    return {
      id: row.id,
      title: json<LocalizedText>(row.title, {}),
      slug: row.slug,
      description: json<LocalizedText>(row.description, {}),
      image_url: row.image_url,
      kind: row.kind as CollectionKind,
      rules: rules_schema.catch(EMPTY_RULES).parse(json(row.rules, EMPTY_RULES)),
      sort: row.sort as CollectionSort,
      is_published: bool(row.is_published),
      seo: parseSeo(json(row.seo, null)),
      sort_order: row.sort_order,
      product_ids,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  async function one(row: Selectable<CollectionsTable> | undefined): Promise<AdminCollection | null> {
    if (!row) return null;
    return toCollection(row, (await productIds([row.id])).get(row.id) ?? []);
  }

  return {
    async list() {
      const rows = await db.selectFrom("collections").selectAll().orderBy("sort_order").orderBy("created_at").execute();
      const ids = await productIds(rows.map((row) => row.id));
      return rows.map((row) => toCollection(row, ids.get(row.id) ?? []));
    },

    async get(id) {
      const found = await one(await db.selectFrom("collections").selectAll().where("id", "=", id).executeTakeFirst());
      if (!found) throw new BackendError("not_found");
      return found;
    },

    async create(input) {
      const id = newId();
      const last = await db
        .selectFrom("collections")
        .select((eb) => eb.fn.max("sort_order").as("max"))
        .executeTakeFirst();
      await db
        .insertInto("collections")
        .values({ id, ...columns(input), sort_order: Number(last?.max ?? 0) + 1 })
        .execute()
        .catch(slugTaken);
      return { id };
    },

    async update(id, input) {
      const result = await db
        .updateTable("collections")
        .set({ ...columns(input), updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst()
        .catch(slugTaken);
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async delete(id) {
      const result = await db.deleteFrom("collections").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },

    async setProducts(id, product_ids) {
      await db.transaction().execute(async (trx) => {
        const exists = await trx.selectFrom("collections").select("id").where("id", "=", id).executeTakeFirst();
        if (!exists) throw new BackendError("not_found");
        await trx.deleteFrom("collection_products").where("collection_id", "=", id).execute();
        const live = product_ids.length
          ? new Set(
              (await trx.selectFrom("products").select("id").where("id", "in", product_ids).execute()).map(
                (row) => row.id,
              ),
            )
          : new Set<string>();
        const rows = [...new Set(product_ids)]
          .filter((product_id) => live.has(product_id))
          .map((product_id, position) => ({ id: newId(), collection_id: id, product_id, position }));
        if (rows.length > 0) await trx.insertInto("collection_products").values(rows).execute();
        await trx.updateTable("collections").set({ updated_at: nowIso() }).where("id", "=", id).execute();
      });
    },

    async published(slug) {
      return one(
        await db
          .selectFrom("collections")
          .selectAll()
          .where("slug", "=", slug)
          .where("is_published", "=", true)
          .executeTakeFirst(),
      );
    },

    async publishedById(id) {
      return one(
        await db
          .selectFrom("collections")
          .selectAll()
          .where("id", "=", id)
          .where("is_published", "=", true)
          .executeTakeFirst(),
      );
    },

    async publishedSlugs() {
      const rows = await db
        .selectFrom("collections")
        .select(["slug", "updated_at"])
        .where("is_published", "=", true)
        .execute();
      return rows.map((row) => ({ slug: row.slug, updated_at: iso(row.updated_at) }));
    },
  };
}
