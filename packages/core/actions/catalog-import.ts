"use server";

import { revalidatePath } from "next/cache";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { ImportItemResult, ImportOutcome, ImportReason } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, callerCan } from "@repo/core/lib/auth";
import { titleCase } from "@repo/core/lib/catalog-import";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@repo/core/lib/schemas/catalog";
import {
  import_categories_schema,
  import_products_schema,
  type ImportCategoriesInput,
  type ImportProductsInput,
} from "@repo/core/lib/schemas/catalog-import";
import { reportError } from "@repo/core/lib/server-log";
import { EMPTY_SEO } from "@repo/core/lib/schemas/seo";

// The import page parses the CSV in the browser and sends it here a few products at a time,
// so a catalog of thousands never hits a request timeout and the page can show progress.

export type { ImportItemResult, ImportOutcome, ImportReason };

const IMAGE_TIMEOUT_MS = 15_000;

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

async function downloadImages(urls: string[]): Promise<File[]> {
  return (await Promise.all(urls.map(downloadImage))).filter((file): file is File => file !== null);
}

export async function importProducts(input: ImportProductsInput): Promise<ActionResult<ImportItemResult[]>> {
  const auth = await authorize("products.edit", "import products");
  if (!auth.ok) return auth;
  const parsed = import_products_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { products, update_existing, download_images } = parsed.data;
  const can_create_categories = callerCan(auth.caller, "categories.edit");

  try {
    const catalog = getBackend().catalog;
    const categories = await catalog.categoryIdsBySlug();

    // Missing categories first, one at a time (two products may share a new one).
    for (const handle of new Set(products.map((product) => product.category).filter(Boolean))) {
      if (categories.has(handle) || !can_create_categories) continue;
      const name = titleCase(handle);
      const { id } = await catalog.createCategory({
        slug: handle,
        name: { en: name, es: name, it: name },
        description: {},
        parent: "",
        sort_order: 0,
        is_active: true,
        seo: EMPTY_SEO,
      });
      categories.set(handle, id);
    }

    const results = await Promise.all(
      products.map(async (product): Promise<ImportItemResult> => {
        if (product.category && !categories.has(product.category)) {
          return { handle: product.handle, outcome: "failed", reason: "category_forbidden" };
        }
        try {
          return await catalog.importProduct(product, categories.get(product.category) ?? "", {
            update_existing,
            loadImages: download_images ? () => downloadImages(product.image_urls) : null,
          });
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
      details: { handles: results.map((result) => `${result.handle}:${result.outcome}`) },
    });
    revalidateCatalog();
    return ok(results);
  } catch (error) {
    return failFrom(error, "catalog-import", "importProducts");
  }
}

export async function importCategories(input: ImportCategoriesInput): Promise<ActionResult<ImportItemResult[]>> {
  const auth = await authorize("categories.edit", "import categories");
  if (!auth.ok) return auth;
  const parsed = import_categories_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const catalog = getBackend().catalog;
    const ids = await catalog.categoryIdsBySlug();
    const results: ImportItemResult[] = [];

    // In order: the page sends parents before their children.
    for (const category of parsed.data.categories) {
      try {
        // An unknown parent leaves the category at the top level rather than failing it.
        const { id, ...result } = await catalog.importCategory(
          category,
          ids.get(category.parent) ?? "",
          parsed.data.update_existing,
        );
        if (id) ids.set(category.handle, id);
        results.push(result);
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
    return failFrom(error, "catalog-import", "importCategories");
  }
}
