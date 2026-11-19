import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";

// Content → Files: the media library shared by themes, pages and products.

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
// Files picked at once in the Files screen or a picker.
export const MAX_MEDIA_BATCH = 20;

export const media_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type MediaFilters = z.infer<typeof media_filters_schema>;

export const update_media_schema = z.object({
  id: id_schema,
  name: z.string().trim().min(1).max(200),
  // Describes the image for screen readers and search engines.
  alt: z.string().trim().max(500),
});
export type UpdateMediaInput = z.infer<typeof update_media_schema>;

export const add_product_images_from_media_schema = z.object({
  product_id: id_schema,
  media_ids: z.array(id_schema).min(1).max(MAX_MEDIA_BATCH),
});
export type AddProductImagesFromMediaInput = z.infer<typeof add_product_images_from_media_schema>;
