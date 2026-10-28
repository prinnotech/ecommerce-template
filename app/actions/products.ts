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
  IMAGE_TYPES,
  image_order_schema,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  product_list_filters_schema,
  product_schema,
  record_id_schema,
  remove_image_schema,
  save_variants_schema,
  update_product_schema,
  type ImageOrderInput,
  type ProductInput,
  type ProductListFilters,
  type ProductStatus,
  type RemoveImageInput,
  type SaveVariantsInput,
  type UpdateProductInput,
} from "@/lib/schemas/catalog";
import { reportError } from "@/lib/server-log";
import type { ProductsResponse, ProductVariantsResponse } from "@/types/pocketbase-types";

const PAGE_SIZE = 25;

type ProductRecord = ProductsResponse<LocalizedText, string[], LocalizedText>;

export type AdminProductRow = {
  id: string;
  title: LocalizedText;
  slug: string;
  status: ProductStatus;
  price: number;
  compare_at_price: number;
  category_id: string;
  image_url: string;
  variant_count: number;
  total_stock: number;
  updated_at: string;
};

export type AdminProductPage = {
  items: AdminProductRow[];
  page: number;
  total_pages: number;
  total_items: number;
};

export type AdminProductImage = { name: string; url: string };

export type AdminVariant = Pick<
  ProductVariantsResponse,
  "id" | "size" | "color" | "color_hex" | "sku" | "price_override" | "stock" | "is_active" | "sort_order"
>;

export type AdminProduct = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  slug: string;
  category: string;
  price: number;
  compare_at_price: number;
  status: ProductStatus;
  is_featured: boolean;
  tags: string[];
  images: AdminProductImage[];
  variants: AdminVariant[];
  created_at: string;
  updated_at: string;
};

const VARIANT_FIELDS = "id,size,color,color_hex,sku,price_override,stock,is_active,sort_order";

// Storefront pages read products, so any catalog change refreshes them.
function revalidateCatalog() {
  revalidatePath("/", "layout");
}

function productImages(record: ProductRecord): AdminProductImage[] {
  return (record.images ?? []).map((name) => ({ name, url: getFileUrl(record, name, "400x500") }));
}

// PocketBase filter values must go through pb.filter() placeholders, never string concatenation.
function buildListFilter(pb: Awaited<ReturnType<typeof createAdminPocketBase>>, filters: ProductListFilters): string {
  const parts = ['deleted_at = ""'];
  if (filters.status !== "all") parts.push(pb.filter("status = {:status}", { status: filters.status }));
  if (filters.category) parts.push(pb.filter("category = {:category}", { category: filters.category }));
  if (filters.search) {
    parts.push(pb.filter("(title ~ {:search} || slug ~ {:search} || tags ~ {:search})", { search: filters.search }));
  }
  return parts.join(" && ");
}

export async function getAdminProducts(input: Partial<ProductListFilters>): Promise<ActionResult<AdminProductPage>> {
  const auth = await authorize("products.view", "view products");
  if (!auth.ok) return auth;
  const filters = product_list_filters_schema.parse(input);

  try {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("products").getList<ProductRecord>(filters.page, PAGE_SIZE, {
      filter: buildListFilter(pb, filters),
      sort: "-updated_at",
      fields: "id,collectionId,title,slug,status,price,compare_at_price,category,images,updated_at",
    });

    const ids = result.items.map((item) => item.id);
    const variants =
      ids.length > 0
        ? await pb.collection("product_variants").getFullList({
            filter: ids.map((id, index) => pb.filter(`product = {:p${index}}`, { [`p${index}`]: id })).join(" || "),
            fields: "product,stock",
          })
        : [];
    const stock = new Map<string, { count: number; total: number }>();
    for (const variant of variants) {
      const entry = stock.get(variant.product) ?? { count: 0, total: 0 };
      stock.set(variant.product, { count: entry.count + 1, total: entry.total + variant.stock });
    }

    return ok({
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title ?? {},
        slug: item.slug,
        status: item.status,
        price: item.price,
        compare_at_price: item.compare_at_price,
        category_id: item.category,
        image_url: item.images?.[0] ? getFileUrl(item, item.images[0], "100x100") : "",
        variant_count: stock.get(item.id)?.count ?? 0,
        total_stock: stock.get(item.id)?.total ?? 0,
        updated_at: item.updated_at,
      })),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    });
  } catch (error) {
    await reportError("products", "getAdminProducts", error);
    return fail("generic");
  }
}

export async function getAdminProduct(id: string): Promise<ActionResult<AdminProduct>> {
  const auth = await authorize("products.view", "view a product");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("not_found");

  try {
    const pb = await createAdminPocketBase();
    const [record, variants] = await Promise.all([
      pb.collection("products").getOne<ProductRecord>(id),
      pb.collection("product_variants").getFullList({
        filter: pb.filter("product = {:id}", { id }),
        sort: "sort_order,created_at",
        fields: VARIANT_FIELDS,
      }),
    ]);
    if (record.deleted_at) return fail("not_found");

    return ok({
      id: record.id,
      title: record.title ?? {},
      description: record.description ?? {},
      slug: record.slug,
      category: record.category,
      price: record.price,
      compare_at_price: record.compare_at_price,
      status: record.status,
      is_featured: record.is_featured,
      tags: Array.isArray(record.tags) ? record.tags : [],
      images: productImages(record),
      variants,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "getAdminProduct", error);
    return fail("generic");
  }
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("products.edit", "create a product");
  if (!auth.ok) return auth;
  const parsed = product_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("products").create(parsed.data);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a product",
      target_type: "products",
      target_id: record.id,
      details: { slug: record.slug },
    });
    revalidateCatalog();
    return ok({ id: record.id });
  } catch (error) {
    if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") return fail("slug_taken");
    await reportError("products", "createProduct", error);
    return fail("generic");
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<ActionResult<null>> {
  const auth = await authorize("products.edit", "update a product");
  if (!auth.ok) return auth;
  const parsed = update_product_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { id, product } = parsed.data;

  try {
    const pb = await createAdminPocketBase();
    const existing = await pb.collection("products").getOne(id, { fields: "status,price,deleted_at" });
    if (existing.deleted_at) return fail("not_found");

    await pb.collection("products").update(id, product);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update a product",
      target_type: "products",
      target_id: id,
      details: {
        before: { status: existing.status, price: existing.price },
        after: { status: product.status, price: product.price },
      },
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") return fail("slug_taken");
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "updateProduct", error);
    return fail("generic");
  }
}

// Soft delete: past orders still point at the product, so the row stays.
export async function deleteProduct(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("products.edit", "delete a product");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    await pb.collection("products").update(id, { deleted_at: new Date().toISOString(), status: "archived" });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a product",
      target_type: "products",
      target_id: id,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "deleteProduct", error);
    return fail("generic");
  }
}

// Replaces the product's variant list in one atomic batch: updates kept rows,
// creates new ones and deletes the rest. Sort order follows the array.
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
    const pb = await createAdminPocketBase();
    const product = await pb.collection("products").getOne(product_id, { fields: "id,deleted_at" });
    if (product.deleted_at) return fail("not_found");

    const existing = await pb.collection("product_variants").getFullList({
      filter: pb.filter("product = {:id}", { id: product_id }),
      fields: "id",
    });
    const existing_ids = new Set(existing.map((variant) => variant.id));
    // An id that isn't one of this product's variants is refused, not silently re-parented.
    if (variants.some((variant) => variant.id && !existing_ids.has(variant.id))) return fail("invalid_input");
    const kept_ids = new Set(variants.map((variant) => variant.id).filter(Boolean));

    const batch = pb.createBatch();
    for (const id of existing_ids) {
      if (!kept_ids.has(id)) batch.collection("product_variants").delete(id);
    }
    variants.forEach((variant, index) => {
      const { id, ...fields } = variant;
      const row = { ...fields, sku: fields.sku.toUpperCase(), product: product_id, sort_order: index };
      if (id) batch.collection("product_variants").update(id, row);
      else batch.collection("product_variants").create(row);
    });
    await batch.send();

    const saved = await pb.collection("product_variants").getFullList({
      filter: pb.filter("product = {:id}", { id: product_id }),
      sort: "sort_order,created_at",
      fields: VARIANT_FIELDS,
    });
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
    // The batch reports field errors per request; a unique-index clash means a SKU used by another product.
    if (JSON.stringify((error as { response?: unknown })?.response ?? "").includes("validation_not_unique")) {
      return fail("sku_taken");
    }
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "saveVariants", error);
    return fail("generic");
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
    const pb = await createAdminPocketBase();
    const current = await pb.collection("products").getOne<ProductRecord>(product_id, { fields: "images,deleted_at" });
    if (current.deleted_at) return fail("not_found");
    if ((current.images ?? []).length >= MAX_PRODUCT_IMAGES) return fail("too_many_images");

    const record = await pb.collection("products").update<ProductRecord>(product_id, { "images+": file });
    revalidateCatalog();
    return ok(productImages(record));
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "uploadProductImage", error);
    return fail("generic");
  }
}

export async function removeProductImage(input: RemoveImageInput): Promise<ActionResult<AdminProductImage[]>> {
  const auth = await authorize("products.edit", "remove a product image");
  if (!auth.ok) return auth;
  const parsed = remove_image_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("products")
      .update<ProductRecord>(parsed.data.product_id, { "images-": [parsed.data.image] });
    revalidateCatalog();
    return ok(productImages(record));
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "removeProductImage", error);
    return fail("generic");
  }
}

// The first image is the main one on the storefront.
export async function reorderProductImages(input: ImageOrderInput): Promise<ActionResult<AdminProductImage[]>> {
  const auth = await authorize("products.edit", "reorder product images");
  if (!auth.ok) return auth;
  const parsed = image_order_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const current = await pb.collection("products").getOne<ProductRecord>(parsed.data.product_id, { fields: "images" });
    const current_names = [...(current.images ?? [])].sort();
    // Same files, different order only: a reorder must never delete or add images.
    if (JSON.stringify([...parsed.data.images].sort()) !== JSON.stringify(current_names)) return fail("invalid_input");

    const record = await pb
      .collection("products")
      .update<ProductRecord>(parsed.data.product_id, { images: parsed.data.images });
    revalidateCatalog();
    return ok(productImages(record));
  } catch (error) {
    if (pocketBaseStatus(error) === 404) return fail("not_found");
    await reportError("products", "reorderProductImages", error);
    return fail("generic");
  }
}
