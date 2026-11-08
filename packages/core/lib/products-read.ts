import "server-only";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminProduct, AdminProductRow, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { authorize } from "@repo/core/lib/auth";
import { product_list_filters_schema, record_id_schema, type ProductListFilters } from "@repo/core/lib/schemas/catalog";

export type AdminProductPage = Page<AdminProductRow>;
const PAGE_SIZE = 25;

// The admin's product reads, shared by Server Components and actions/products.ts (see lib/orders-read.ts).
export async function readAdminProducts(input: Partial<ProductListFilters>): Promise<ActionResult<AdminProductPage>> {
  const auth = await authorize("products.view", "view products");
  if (!auth.ok) return auth;
  const filters = product_list_filters_schema.parse(input);

  try {
    return ok(await getBackend().catalog.listProducts(filters, PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "products", "readAdminProducts");
  }
}

export async function readAdminProduct(id: string): Promise<ActionResult<AdminProduct>> {
  const auth = await authorize("products.view", "view a product");
  if (!auth.ok) return auth;
  if (!record_id_schema.safeParse(id).success) return fail("not_found");

  try {
    return ok(await getBackend().catalog.getProduct(id));
  } catch (error) {
    return failFrom(error, "products", "readAdminProduct");
  }
}
