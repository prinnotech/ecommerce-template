import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { bulk_ids_schema } from "@repo/core/lib/schemas/admin";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { seo_schema } from "@repo/core/lib/schemas/seo";

const optional_id_schema = z.union([id_schema, z.literal("")]);
const cents_schema = z.number("invalid").int("invalid").min(0, "invalid").max(100_000_000, "invalid");

export const slug_schema = z
  .string("required")
  .trim()
  .min(1, "required")
  .max(160, "too_long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid_slug");

function localizedText(max: number) {
  return z.partialRecord(z.enum(LOCALES), z.string().trim().max(max, "too_long"));
}

// At least one language must be filled; the storefront falls back to it.
function requiredLocalizedText(max: number) {
  return localizedText(max).refine((value) => Object.values(value).some((text) => text && text.length > 0), "required");
}

// ---------- Categories ----------

export const category_schema = z.object({
  name: requiredLocalizedText(120),
  slug: slug_schema,
  description: localizedText(2000),
  parent: optional_id_schema,
  sort_order: z.number().int().min(0).max(10_000),
  is_active: z.boolean(),
  seo: seo_schema,
});
export type CategoryInput = z.infer<typeof category_schema>;

export const update_category_schema = category_schema.extend({ id: id_schema });
export type UpdateCategoryInput = z.infer<typeof update_category_schema>;

// ---------- Products ----------

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const product_schema = z
  .object({
    title: requiredLocalizedText(200),
    description: localizedText(10_000),
    slug: slug_schema,
    category: optional_id_schema,
    price: cents_schema,
    // 0 = no "compare at" price shown.
    compare_at_price: cents_schema,
    status: z.enum(PRODUCT_STATUSES),
    is_featured: z.boolean(),
    // Sold as a gift card: paying for it issues a card with that value (and emails the code).
    is_gift_card: z.boolean(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    seo: seo_schema,
  })
  .refine((value) => value.compare_at_price === 0 || value.compare_at_price > value.price, {
    message: "compare_at_too_low",
    path: ["compare_at_price"],
  });
export type ProductInput = z.infer<typeof product_schema>;

export const update_product_schema = z.object({ id: id_schema, product: product_schema });
export type UpdateProductInput = z.infer<typeof update_product_schema>;

export const product_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...PRODUCT_STATUSES]).catch("all"),
  category: optional_id_schema.catch(""),
  sort: z.enum(["updated_at", "created_at", "price"]).catch("updated_at"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ProductListFilters = z.infer<typeof product_list_filters_schema>;

// ---------- Variants ----------

export const variant_schema = z.object({
  // Empty for a new variant.
  id: optional_id_schema,
  size: z.string().trim().max(30, "too_long"),
  color: z.string().trim().max(50, "too_long"),
  color_hex: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]),
  sku: z.string().trim().max(64, "too_long"),
  // 0 = use the product price.
  price_override: cents_schema,
  stock: z.number("invalid").int("invalid").min(0, "invalid").max(1_000_000, "invalid"),
  is_active: z.boolean(),
});
export type VariantInput = z.infer<typeof variant_schema>;

export const save_variants_schema = z
  .object({ product_id: id_schema, variants: z.array(variant_schema).max(250) })
  .refine(
    (value) => {
      const skus = value.variants.map((variant) => variant.sku.toUpperCase()).filter(Boolean);
      return new Set(skus).size === skus.length;
    },
    { message: "duplicate_sku", path: ["variants"] },
  );
export type SaveVariantsInput = z.infer<typeof save_variants_schema>;

// ---------- Images ----------

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 10;

export const image_order_schema = z.object({
  product_id: id_schema,
  images: z.array(z.string().min(1).max(200)).max(MAX_PRODUCT_IMAGES),
});
export type ImageOrderInput = z.infer<typeof image_order_schema>;

export const remove_image_schema = z.object({ product_id: id_schema, image: z.string().min(1).max(200) });
export type RemoveImageInput = z.infer<typeof remove_image_schema>;

export const record_id_schema = id_schema;

// ---------- Admin bulk actions and tree ----------

export const bulk_product_status_schema = z.object({ ids: bulk_ids_schema, status: z.enum(PRODUCT_STATUSES) });
export type BulkProductStatusInput = z.infer<typeof bulk_product_status_schema>;

export const bulk_product_category_schema = z.object({ ids: bulk_ids_schema, category: optional_id_schema });
export type BulkProductCategoryInput = z.infer<typeof bulk_product_category_schema>;

export const bulk_products_schema = z.object({ ids: bulk_ids_schema });
export type BulkProductsInput = z.infer<typeof bulk_products_schema>;

// "" = the image shows for every color.
export const image_color_schema = z.object({
  product_id: id_schema,
  image: z.string().min(1).max(200),
  color: z.string().trim().max(50),
});
export type ImageColorInput = z.infer<typeof image_color_schema>;

export const move_categories_schema = z
  .array(z.object({ id: id_schema, parent_id: optional_id_schema, sort_order: z.number().int().min(0).max(10_000) }))
  .min(1)
  .max(1000)
  // A category can't be its own parent; deeper cycles are checked against the whole tree in the action.
  .refine((moves) => moves.every((move) => move.id !== move.parent_id), "invalid");
export type MoveCategoriesInput = z.infer<typeof move_categories_schema>;
