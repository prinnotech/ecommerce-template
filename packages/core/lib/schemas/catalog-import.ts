import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { PRODUCT_STATUSES, slug_schema } from "@repo/core/lib/schemas/catalog";

// One CSV product (rows grouped by handle) / one CSV category, after parsing.
// Shared by the import page (preview) and the import actions (validated again on the server).

const cents_schema = z.number().int().min(0).max(100_000_000);

function localizedText(max: number) {
  return z.partialRecord(z.enum(LOCALES), z.string().trim().max(max));
}

const image_url_schema = z.url({ protocol: /^https?$/ }).max(2000);

export const import_product_schema = z.object({
  handle: slug_schema,
  title: localizedText(200).refine((value) => Object.values(value).some(Boolean)),
  description: localizedText(10_000),
  // Category handle; created when it doesn't exist. Empty = no category.
  category: z.union([slug_schema, z.literal("")]),
  price: cents_schema.min(1),
  compare_at_price: cents_schema,
  status: z.enum(PRODUCT_STATUSES),
  is_featured: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  image_urls: z.array(image_url_schema).max(10),
  variants: z
    .array(
      z.object({
        size: z.string().trim().max(30),
        color: z.string().trim().max(50),
        color_hex: z.union([z.string().regex(/^#[0-9a-f]{6}$/), z.literal("")]),
        sku: z.string().trim().min(1).max(64),
        price_override: cents_schema,
        stock: z.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1)
    // Many colors × many sizes (shoe ranges can reach ~400); the editor's 250 limit is for hand-made products.
    .max(1000),
});
export type ImportProduct = z.infer<typeof import_product_schema>;

export const IMPORT_PRODUCTS_PER_REQUEST = 5;

export const import_products_schema = z.object({
  products: z.array(import_product_schema).min(1).max(IMPORT_PRODUCTS_PER_REQUEST),
  update_existing: z.boolean(),
  download_images: z.boolean(),
});
export type ImportProductsInput = z.infer<typeof import_products_schema>;

export const import_category_schema = z.object({
  handle: slug_schema,
  name: localizedText(120).refine((value) => Object.values(value).some(Boolean)),
  description: localizedText(2000),
  parent: z.union([slug_schema, z.literal("")]),
  sort_order: z.number().int().min(0).max(10_000),
  is_active: z.boolean(),
});
export type ImportCategory = z.infer<typeof import_category_schema>;

export const IMPORT_CATEGORIES_PER_REQUEST = 100;

export const import_categories_schema = z.object({
  categories: z.array(import_category_schema).min(1).max(IMPORT_CATEGORIES_PER_REQUEST),
  update_existing: z.boolean(),
});
export type ImportCategoriesInput = z.infer<typeof import_categories_schema>;
