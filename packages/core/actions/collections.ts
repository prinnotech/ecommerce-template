"use server";

import { revalidatePath } from "next/cache";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminCollection } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { collectionProductIds } from "@repo/core/lib/collections-server";
import {
  collection_products_schema,
  collection_schema,
  type CollectionInput,
} from "@repo/core/lib/schemas/collections";
import { id_schema } from "@repo/core/lib/schemas/ids";
import type { ProductStatus } from "@repo/core/lib/schemas/catalog";
import type { LocalizedText } from "@repo/core/lib/localized";

// Products → Collections (admin). The store reads them through actions/storefront.ts.

export type CollectionRow = AdminCollection & { product_count: number };

export async function getCollections(): Promise<ActionResult<CollectionRow[]>> {
  const auth = await authorize("collections.view", "view collections");
  if (!auth.ok) return auth;
  try {
    const collections = await getBackend().collections.list();
    // Counts follow the rules for automatic ones (what the store would show).
    const counts = await Promise.all(collections.map((collection) => collectionProductIds(collection)));
    return ok(collections.map((collection, index) => ({ ...collection, product_count: counts[index]?.length ?? 0 })));
  } catch (error) {
    return failFrom(error, "collections", "getCollections");
  }
}

export type CollectionProduct = { id: string; title: LocalizedText; image_url: string; status: ProductStatus };
export type CollectionView = { collection: AdminCollection; products: CollectionProduct[] };

export async function getCollection(id: string): Promise<ActionResult<CollectionView>> {
  const auth = await authorize("collections.view", "view a collection");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const backend = getBackend();
    const collection = await backend.collections.get(id);
    // The picked products as staff see them (drafts too), skipping deleted ones.
    const products = await Promise.all(
      collection.product_ids.map((product_id) => backend.catalog.getProduct(product_id).catch(() => null)),
    );
    return ok({
      collection,
      products: products
        .filter((product) => product !== null)
        .map((product) => ({
          id: product.id,
          title: product.title,
          image_url: product.images[0]?.url ?? "",
          status: product.status,
        })),
    });
  } catch (error) {
    return failFrom(error, "collections", "getCollection");
  }
}

// The store's pages list collections (and the theme can show one), so changes refresh them.
function revalidateStore() {
  revalidatePath("/", "layout");
}

export async function createCollection(input: CollectionInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("collections.edit", "create a collection");
  if (!auth.ok) return auth;
  const parsed = collection_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const { id } = await getBackend().collections.create(parsed.data);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a collection",
      target_type: "collection",
      target_id: id,
      details: { slug: parsed.data.slug, kind: parsed.data.kind },
    });
    revalidateStore();
    return ok({ id });
  } catch (error) {
    return failFrom(error, "collections", "createCollection");
  }
}

export async function updateCollection(input: {
  id: string;
  collection: CollectionInput;
}): Promise<ActionResult<null>> {
  const auth = await authorize("collections.edit", "edit a collection");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success) return fail("not_found");
  const parsed = collection_schema.safeParse(input.collection);
  if (!parsed.success) return fail("invalid_input");
  try {
    await getBackend().collections.update(input.id, parsed.data);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit a collection",
      target_type: "collection",
      target_id: input.id,
      details: { slug: parsed.data.slug, is_published: parsed.data.is_published },
    });
    revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "collections", "updateCollection");
  }
}

export async function setCollectionProducts(input: { id: string; product_ids: string[] }): Promise<ActionResult<null>> {
  const auth = await authorize("collections.edit", "edit a collection");
  if (!auth.ok) return auth;
  const parsed = collection_products_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    await getBackend().collections.setProducts(parsed.data.id, parsed.data.product_ids);
    revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "collections", "setCollectionProducts");
  }
}

export async function deleteCollection(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("collections.edit", "delete a collection");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().collections.delete(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a collection",
      target_type: "collection",
      target_id: id,
    });
    revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "collections", "deleteCollection");
  }
}
