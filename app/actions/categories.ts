"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity-log";
import { authorize } from "@/lib/auth";
import type { LocalizedText } from "@/lib/localized";
import { pocketBaseFieldCode, pocketBaseStatus } from "@/lib/pocketbase/errors";
import { getFileUrl } from "@/lib/pocketbase/files";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import {
  category_schema,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  record_id_schema,
  update_category_schema,
  type CategoryInput,
  type UpdateCategoryInput,
} from "@/lib/schemas/catalog";
import { reportError } from "@/lib/server-log";
import type { CategoriesResponse } from "@/types/pocketbase-types";

export type AdminCategory = {
  id: string;
  name: LocalizedText;
  slug: string;
  description: LocalizedText;
  parent: string;
  sort_order: number;
  is_active: boolean;
  image_url: string;
  product_count: number;
};

type CategoryRecord = CategoriesResponse<LocalizedText, LocalizedText>;

function toAdminCategory(record: CategoryRecord, product_count: number): AdminCategory {
  return {
    id: record.id,
    name: record.name ?? {},
    slug: record.slug,
    description: record.description ?? {},
    parent: record.parent,
    sort_order: record.sort_order,
    is_active: record.is_active,
    image_url: record.image ? getFileUrl(record, record.image, "400x400") : "",
    product_count,
  };
}

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

function categoryRow(input: CategoryInput) {
  return { ...input, slug: input.slug.toLowerCase() };
}

// Readable by anyone who can see products, since the product editor needs the list too.
export async function getAdminCategories(): Promise<ActionResult<AdminCategory[]>> {
  const auth = await authorize("products.view", "view categories");
  if (!auth.ok) return auth;

  try {
    const pb = await createAdminPocketBase();
    const [categories, products] = await Promise.all([
      pb.collection("categories").getFullList<CategoryRecord>({ sort: "sort_order,created_at" }),
      pb.collection("products").getFullList({ filter: 'deleted_at = "" && category != ""', fields: "category" }),
    ]);
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return ok(categories.map((category) => toAdminCategory(category, counts.get(category.id) ?? 0)));
  } catch (error) {
    await reportError("categories", "getAdminCategories", error);
    return fail("generic");
  }
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("categories.edit", "create a category");
  if (!auth.ok) return auth;
  const parsed = category_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("categories").create(categoryRow(parsed.data));
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a category",
      target_type: "categories",
      target_id: record.id,
      details: { slug: record.slug },
    });
    revalidateCatalog();
    return ok({ id: record.id });
  } catch (error) {
    if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") return fail("slug_taken");
    await reportError("categories", "createCategory", error);
    return fail("generic");
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<ActionResult<null>> {
  const auth = await authorize("categories.edit", "update a category");
  if (!auth.ok) return auth;
  const parsed = update_category_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, ...fields } = parsed.data;
  // A category can't be its own parent.
  if (fields.parent === id) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    await pb.collection("categories").update(id, categoryRow(fields));
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update a category",
      target_type: "categories",
      target_id: id,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") return fail("slug_taken");
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("categories", "updateCategory", error);
    return fail("generic");
  }
}

// Refused while products or subcategories still use it, so nothing ends up orphaned.
export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("categories.edit", "delete a category");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    // Soft-deleted products don't count; PocketBase clears their optional relation on delete.
    const filter = pb.filter('category = {:id} && deleted_at = ""', { id });
    const [products, children] = await Promise.all([
      pb.collection("products").getList(1, 1, { filter, fields: "id" }),
      pb.collection("categories").getList(1, 1, { filter: pb.filter("parent = {:id}", { id }), fields: "id" }),
    ]);
    if (products.totalItems > 0 || children.totalItems > 0) return fail("category_in_use");

    await pb.collection("categories").delete(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a category",
      target_type: "categories",
      target_id: id,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("categories", "deleteCategory", error);
    return fail("generic");
  }
}

// FormData: id, image (File). Replaces the current image.
export async function uploadCategoryImage(form_data: FormData): Promise<ActionResult<{ image_url: string }>> {
  const auth = await authorize("categories.edit", "upload a category image");
  if (!auth.ok) return auth;

  const id = form_data.get("id");
  const file = form_data.get("image");
  if (typeof id !== "string" || !record_id_schema.safeParse(id).success || !(file instanceof File)) {
    return fail("invalid_input");
  }
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return fail("invalid_image");
  if (file.size > MAX_IMAGE_BYTES) return fail("image_too_large");

  try {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("categories").update<CategoryRecord>(id, { image: file });
    revalidateCatalog();
    return ok({ image_url: getFileUrl(record, record.image, "400x400") });
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("categories", "uploadCategoryImage", error);
    return fail("generic");
  }
}

export async function removeCategoryImage(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("categories.edit", "remove a category image");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    await pb.collection("categories").update(id, { image: null });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("categories", "removeCategoryImage", error);
    return fail("generic");
  }
}
