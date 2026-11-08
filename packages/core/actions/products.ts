"use server";

import { revalidatePath } from "next/cache";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminProduct, AdminProductImage, AdminProductRow, AdminVariant, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { readAdminProduct, readAdminProducts } from "@repo/core/lib/products-read";
import {
  bulk_product_category_schema,
  bulk_product_status_schema,
  bulk_products_schema,
  IMAGE_TYPES,
  image_color_schema,
  image_order_schema,
  MAX_IMAGE_BYTES,
  product_schema,
  record_id_schema,
  remove_image_schema,
  save_variants_schema,
  update_product_schema,
  type BulkProductCategoryInput,
  type BulkProductStatusInput,
  type BulkProductsInput,
  type ImageColorInput,
  type ImageOrderInput,
  type ProductInput,
  type ProductListFilters,
  type RemoveImageInput,
  type SaveVariantsInput,
  type UpdateProductInput,
} from "@repo/core/lib/schemas/catalog";

export type { AdminProduct, AdminProductImage, AdminProductRow, AdminVariant };
export type AdminProductPage = Page<AdminProductRow>;

// Storefront pages read products, so any catalog change refreshes them.
function revalidateCatalog() {
  revalidatePath("/", "layout");
}

export async function getAdminProducts(input: Partial<ProductListFilters>): Promise<ActionResult<AdminProductPage>> {
  return readAdminProducts(input);
}

export async function getAdminProduct(id: string): Promise<ActionResult<AdminProduct>> {
  return readAdminProduct(id);
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("products.edit", "create a product");
  if (!auth.ok) return auth;
  const parsed = product_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const { id, slug } = await getBackend().catalog.createProduct(parsed.data);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a product",
      target_type: "products",
      target_id: id,
      details: { slug },
    });
    revalidateCatalog();
    return ok({ id });
  } catch (error) {
    return failFrom(error, "products", "createProduct");
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<ActionResult<null>> {
  const auth = await authorize("products.edit", "update a product");
  if (!auth.ok) return auth;
  const parsed = update_product_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, product } = parsed.data;

  try {
    const before = await getBackend().catalog.updateProduct(id, product);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update a product",
      target_type: "products",
      target_id: id,
      details: { before, after: { status: product.status, price: product.price } },
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    return failFrom(error, "products", "updateProduct");
  }
}

// Soft delete: past orders still point at the product, so the row stays.
export async function deleteProduct(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("products.edit", "delete a product");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    await getBackend().catalog.deleteProduct(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a product",
      target_type: "products",
      target_id: id,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    return failFrom(error, "products", "deleteProduct");
  }
}

// Replaces the product's variant list in one atomic step. Sort order follows the array.
export async function saveVariants(input: SaveVariantsInput): Promise<ActionResult<AdminVariant[]>> {
  const auth = await authorize("products.edit", "update product variants");
  if (!auth.ok) return auth;
  const parsed = save_variants_schema.safeParse(input);
  if (!parsed.success) {
    const is_duplicate = parsed.error.issues.some((issue) => issue.message === "duplicate_sku");
    return fail(is_duplicate ? "sku_taken" : "invalid_input");
  }
  const { product_id, variants } = parsed.data;

  try {
    const saved = await getBackend().catalog.saveVariants(product_id, variants);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update product variants",
      target_type: "products",
      target_id: product_id,
      details: { count: saved.length },
    });
    revalidateCatalog();
    return ok(saved);
  } catch (error) {
    return failFrom(error, "products", "saveVariants");
  }
}

// FormData: product_id, image (File). Appends one image per call (keeps requests under the size limit).
export async function uploadProductImage(form_data: FormData): Promise<ActionResult<AdminProductImage[]>> {
  const auth = await authorize("products.edit", "upload a product image");
  if (!auth.ok) return auth;

  const product_id = form_data.get("product_id");
  const file = form_data.get("image");
  if (typeof product_id !== "string" || !record_id_schema.safeParse(product_id).success || !(file instanceof File)) {
    return fail("invalid_input");
  }
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return fail("invalid_image");
  if (file.size > MAX_IMAGE_BYTES) return fail("image_too_large");

  try {
    const images = await getBackend().catalog.addProductImage(product_id, file);
    revalidateCatalog();
    return ok(images);
  } catch (error) {
    return failFrom(error, "products", "uploadProductImage");
  }
}

export async function removeProductImage(input: RemoveImageInput): Promise<ActionResult<AdminProductImage[]>> {
  const auth = await authorize("products.edit", "remove a product image");
  if (!auth.ok) return auth;
  const parsed = remove_image_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const images = await getBackend().catalog.removeProductImage(parsed.data.product_id, parsed.data.image);
    revalidateCatalog();
    return ok(images);
  } catch (error) {
    return failFrom(error, "products", "removeProductImage");
  }
}

// The first image is the main one on the storefront.
export async function reorderProductImages(input: ImageOrderInput): Promise<ActionResult<AdminProductImage[]>> {
  const auth = await authorize("products.edit", "reorder product images");
  if (!auth.ok) return auth;
  const parsed = image_order_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const images = await getBackend().catalog.reorderProductImages(parsed.data.product_id, parsed.data.images);
    revalidateCatalog();
    return ok(images);
  } catch (error) {
    return failFrom(error, "products", "reorderProductImages");
  }
}

// ---------- Bulk actions from the products list ----------

export async function bulkSetProductStatus(input: BulkProductStatusInput): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("products.edit", "change the status of products");
  if (!auth.ok) return auth;
  const parsed = bulk_product_status_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const count = await getBackend().catalog.setProductsStatus(parsed.data.ids, parsed.data.status);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the status of products",
      target_type: "products",
      details: { ids: parsed.data.ids, status: parsed.data.status, count },
    });
    revalidateCatalog();
    return ok({ count });
  } catch (error) {
    return failFrom(error, "products", "bulkSetProductStatus");
  }
}

export async function bulkSetProductCategory(
  input: BulkProductCategoryInput,
): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("products.edit", "move products to a category");
  if (!auth.ok) return auth;
  const parsed = bulk_product_category_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const count = await getBackend().catalog.setProductsCategory(parsed.data.ids, parsed.data.category);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "move products to a category",
      target_type: "products",
      details: { ids: parsed.data.ids, category: parsed.data.category, count },
    });
    revalidateCatalog();
    return ok({ count });
  } catch (error) {
    return failFrom(error, "products", "bulkSetProductCategory");
  }
}

// Soft delete, like deleteProduct.
export async function bulkDeleteProducts(input: BulkProductsInput): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("products.edit", "delete products");
  if (!auth.ok) return auth;
  const parsed = bulk_products_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const count = await getBackend().catalog.deleteProducts(parsed.data.ids);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete products",
      target_type: "products",
      details: { ids: parsed.data.ids, count },
    });
    revalidateCatalog();
    return ok({ count });
  } catch (error) {
    return failFrom(error, "products", "bulkDeleteProducts");
  }
}

// Which variant color an image shows ("" = every color).
export async function setProductImageColor(input: ImageColorInput): Promise<ActionResult<AdminProductImage[]>> {
  const auth = await authorize("products.edit", "set an image color");
  if (!auth.ok) return auth;
  const parsed = image_color_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const images = await getBackend().catalog.setImageColor(
      parsed.data.product_id,
      parsed.data.image,
      parsed.data.color,
    );
    revalidateCatalog();
    return ok(images);
  } catch (error) {
    return failFrom(error, "products", "setProductImageColor");
  }
}
