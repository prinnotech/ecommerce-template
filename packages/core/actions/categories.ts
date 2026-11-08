"use server";

import { revalidatePath } from "next/cache";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminCategory } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import {
  category_schema,
  IMAGE_TYPES,
  move_categories_schema,
  MAX_IMAGE_BYTES,
  record_id_schema,
  update_category_schema,
  type CategoryInput,
  type MoveCategoriesInput,
  type UpdateCategoryInput,
} from "@repo/core/lib/schemas/catalog";

export type { AdminCategory };

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

function categoryFields(input: CategoryInput): CategoryInput {
  return { ...input, slug: input.slug.toLowerCase() };
}

// Readable by anyone who can see products, since the product editor needs the list too.
export async function getAdminCategories(): Promise<ActionResult<AdminCategory[]>> {
  const auth = await authorize("products.view", "view categories");
  if (!auth.ok) return auth;

  try {
    return ok(await getBackend().catalog.listCategories());
  } catch (error) {
    return failFrom(error, "categories", "getAdminCategories");
  }
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("categories.edit", "create a category");
  if (!auth.ok) return auth;
  const parsed = category_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const fields = categoryFields(parsed.data);
    const { id } = await getBackend().catalog.createCategory(fields);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a category",
      target_type: "categories",
      target_id: id,
      details: { slug: fields.slug },
    });
    revalidateCatalog();
    return ok({ id });
  } catch (error) {
    return failFrom(error, "categories", "createCategory");
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
    await getBackend().catalog.updateCategory(id, categoryFields(fields));
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update a category",
      target_type: "categories",
      target_id: id,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    return failFrom(error, "categories", "updateCategory");
  }
}

// Refused while products or subcategories still use it, so nothing ends up orphaned.
export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("categories.edit", "delete a category");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await getBackend().catalog.deleteCategory(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a category",
      target_type: "categories",
      target_id: id,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    return failFrom(error, "categories", "deleteCategory");
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
    const result = await getBackend().catalog.setCategoryImage(id, file);
    revalidateCatalog();
    return ok(result);
  } catch (error) {
    return failFrom(error, "categories", "uploadCategoryImage");
  }
}

export async function removeCategoryImage(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("categories.edit", "remove a category image");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await getBackend().catalog.removeCategoryImage(id);
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    return failFrom(error, "categories", "removeCategoryImage");
  }
}

// The categories tree after a drag and drop: new parent and position for the categories that moved.
export async function moveCategories(input: MoveCategoriesInput): Promise<ActionResult<null>> {
  const auth = await authorize("categories.edit", "reorder categories");
  if (!auth.ok) return auth;
  const parsed = move_categories_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const categories = await backend.catalog.listCategories();
    // Apply the moves to the current tree and refuse a loop (a category under its own descendant).
    const parent_of = new Map(categories.map((category) => [category.id, category.parent]));
    for (const move of parsed.data) {
      if (!parent_of.has(move.id) || (move.parent_id && !parent_of.has(move.parent_id))) return fail("not_found");
      parent_of.set(move.id, move.parent_id);
    }
    for (const id of parent_of.keys()) {
      const seen = new Set<string>();
      for (let current = id; current; current = parent_of.get(current) ?? "") {
        if (seen.has(current)) return fail("invalid_input");
        seen.add(current);
      }
    }

    await backend.catalog.moveCategories(parsed.data);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "reorder categories",
      target_type: "categories",
      details: { count: parsed.data.length },
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    return failFrom(error, "categories", "moveCategories");
  }
}
