"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity-log";
import { authorize, callerCan } from "@/lib/auth";
import { titleCase } from "@/lib/catalog-import";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/schemas/catalog";
import {
  import_categories_schema,
  import_products_schema,
  type ImportCategoriesInput,
  type ImportProduct,
  type ImportProductsInput,
} from "@/lib/schemas/catalog-import";
import { reportError } from "@/lib/server-log";

// The import page parses the CSV in the browser and sends it here a few products at a time,
// so a catalog of thousands never hits a request timeout and the page can show progress.

export type ImportOutcome = "created" | "updated" | "skipped" | "failed";
// Keys of dictionary.catalog.import.reasons.
export type ImportReason = "exists" | "sku_taken" | "category_forbidden" | "images_failed" | "generic";
export type ImportItemResult = { handle: string; outcome: ImportOutcome; reason?: ImportReason; images?: number };

type AdminPocketBase = Awaited<ReturnType<typeof createAdminPocketBase>>;

const BATCH_LIMIT = 100; // PocketBase batch.maxRequests (pb_migrations/1793059200)
const IMAGE_TIMEOUT_MS = 15_000;
const SKU_LOOKUP_SIZE = 50;

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

// Admin-only, but the server still shouldn't fetch from its own network.
function isPublicImageUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    if (protocol !== "https:" && protocol !== "http:") return false;
    return !(
      hostname === "localhost" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      /^(127|10|0)\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.startsWith("[")
    );
  } catch {
    // Not a URL.
    return false;
  }
}

async function downloadImage(url: string, index: number): Promise<File | null> {
  if (!isPublicImageUrl(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), redirect: "follow" });
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!response.ok || !(IMAGE_TYPES as readonly string[]).includes(type)) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    const extension = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
    return new File([bytes], `image-${index + 1}.${extension}`, { type });
  } catch {
    // Timeout or network error: the product is imported without this image.
    return null;
  }
}

async function categoryIds(pb: AdminPocketBase): Promise<Map<string, string>> {
  const records = await pb.collection("categories").getFullList({ fields: "id,slug" });
  return new Map(records.map((record) => [record.slug, record.id]));
}

async function importProduct(
  pb: AdminPocketBase,
  item: ImportProduct,
  category_id: string,
  options: { update_existing: boolean; download_images: boolean },
): Promise<ImportItemResult> {
  const existing = await pb
    .collection("products")
    .getFirstListItem(pb.filter('slug = {:slug} && deleted_at = ""', { slug: item.handle }), { fields: "id,images" })
    .catch(() => null);
  if (existing && !options.update_existing) return { handle: item.handle, outcome: "skipped", reason: "exists" };

  // A SKU owned by another product would make the variant batch fail halfway: refuse up front.
  // In groups: PocketBase rejects very long filters (a shoe in 10 colors has ~300 SKUs).
  const skus = item.variants.map((variant) => variant.sku);
  const owned = [];
  for (let start = 0; start < skus.length; start += SKU_LOOKUP_SIZE) {
    const sku_filter = skus
      .slice(start, start + SKU_LOOKUP_SIZE)
      .map((sku, index) => pb.filter(`sku = {:s${index}}`, { [`s${index}`]: sku }))
      .join(" || ");
    owned.push(
      ...(await pb.collection("product_variants").getFullList({ filter: sku_filter, fields: "id,sku,product" })),
    );
  }
  if (owned.some((variant) => variant.product !== existing?.id)) {
    return { handle: item.handle, outcome: "failed", reason: "sku_taken" };
  }

  const fields = {
    slug: item.handle,
    title: item.title,
    description: item.description,
    category: category_id,
    price: item.price,
    compare_at_price: item.compare_at_price,
    status: item.status,
    is_featured: item.is_featured,
    tags: item.tags,
  };
  const product = existing
    ? await pb.collection("products").update(existing.id, fields)
    : await pb.collection("products").create(fields);

  // Upsert by SKU; variants already on the product but not in the file are kept.
  const by_sku = new Map(owned.map((variant) => [variant.sku, variant.id]));
  for (let start = 0; start < item.variants.length; start += BATCH_LIMIT) {
    const batch = pb.createBatch();
    item.variants.slice(start, start + BATCH_LIMIT).forEach((variant, offset) => {
      const row = { ...variant, product: product.id, is_active: true, sort_order: start + offset };
      const id = by_sku.get(variant.sku);
      if (id) batch.collection("product_variants").update(id, row);
      else batch.collection("product_variants").create(row);
    });
    await batch.send();
  }

  // Images only for products without any, so re-importing never duplicates them.
  let images = 0;
  let images_failed = false;
  if (options.download_images && item.image_urls.length > 0 && (existing?.images ?? []).length === 0) {
    const files = (await Promise.all(item.image_urls.map(downloadImage))).filter((file): file is File => file !== null);
    images = files.length;
    images_failed = files.length < item.image_urls.length;
    if (files.length > 0) await pb.collection("products").update(product.id, { images: files });
  }

  return {
    handle: item.handle,
    outcome: existing ? "updated" : "created",
    reason: images_failed ? "images_failed" : undefined,
    images,
  };
}

export async function importProducts(input: ImportProductsInput): Promise<ActionResult<ImportItemResult[]>> {
  const auth = await authorize("products.edit", "import products");
  if (!auth.ok) return auth;
  const parsed = import_products_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { products, ...options } = parsed.data;
  const can_create_categories = callerCan(auth.caller, "categories.edit");

  try {
    const pb = await createAdminPocketBase();
    const categories = await categoryIds(pb);

    // Missing categories first, one at a time (two products may share a new one).
    for (const handle of new Set(products.map((product) => product.category).filter(Boolean))) {
      if (categories.has(handle) || !can_create_categories) continue;
      const name = titleCase(handle);
      const record = await pb.collection("categories").create({
        slug: handle,
        name: { en: name, es: name, it: name },
        is_active: true,
        sort_order: 0,
      });
      categories.set(handle, record.id);
    }

    const results = await Promise.all(
      products.map(async (product): Promise<ImportItemResult> => {
        if (product.category && !categories.has(product.category)) {
          return { handle: product.handle, outcome: "failed", reason: "category_forbidden" };
        }
        try {
          return await importProduct(pb, product, categories.get(product.category) ?? "", options);
        } catch (error) {
          await reportError("catalog-import", `importProduct ${product.handle}`, error);
          return { handle: product.handle, outcome: "failed", reason: "generic" };
        }
      }),
    );

    await logActivity({
      actor_id: auth.caller.user_id,
      action: "import products",
      target_type: "products",
      details: {
        handles: results.map((result) => `${result.handle}:${result.outcome}`),
      },
    });
    revalidateCatalog();
    return ok(results);
  } catch (error) {
    await reportError("catalog-import", "importProducts", error);
    return fail("generic");
  }
}

export async function importCategories(input: ImportCategoriesInput): Promise<ActionResult<ImportItemResult[]>> {
  const auth = await authorize("categories.edit", "import categories");
  if (!auth.ok) return auth;
  const parsed = import_categories_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const pb = await createAdminPocketBase();
    const ids = await categoryIds(pb);
    const results: ImportItemResult[] = [];

    // In order: the page sends parents before their children.
    for (const category of parsed.data.categories) {
      const existing_id = ids.get(category.handle);
      if (existing_id && !parsed.data.update_existing) {
        results.push({ handle: category.handle, outcome: "skipped", reason: "exists" });
        continue;
      }
      const fields = {
        slug: category.handle,
        name: category.name,
        description: category.description,
        // An unknown parent leaves the category at the top level rather than failing it.
        parent: ids.get(category.parent) ?? "",
        sort_order: category.sort_order,
        is_active: category.is_active,
      };
      try {
        const record = existing_id
          ? await pb.collection("categories").update(existing_id, fields)
          : await pb.collection("categories").create(fields);
        ids.set(category.handle, record.id);
        results.push({ handle: category.handle, outcome: existing_id ? "updated" : "created" });
      } catch (error) {
        await reportError("catalog-import", `importCategory ${category.handle}`, error);
        results.push({ handle: category.handle, outcome: "failed", reason: "generic" });
      }
    }

    await logActivity({
      actor_id: auth.caller.user_id,
      action: "import categories",
      target_type: "categories",
      details: { count: results.length },
    });
    revalidateCatalog();
    return ok(results);
  } catch (error) {
    await reportError("catalog-import", "importCategories", error);
    return fail("generic");
  }
}
