import { z } from "zod";

export const SHOP_SORTS = ["featured", "newest", "price_asc", "price_desc"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

// Shop filters come from the URL, so every field falls back instead of failing.
// Prices are whole currency units in the URL (?min=20&max=80) for readability.
export const shop_filters_schema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(160)
    .catch(""),
  size: z.string().trim().max(30).catch(""),
  color: z.string().trim().max(50).catch(""),
  min: z.coerce.number().int().min(0).max(1_000_000).catch(0),
  max: z.coerce.number().int().min(0).max(1_000_000).catch(0),
  in_stock: z
    .enum(["1"])
    .optional()
    .catch(undefined)
    .transform((value) => value === "1"),
  sort: z.enum(SHOP_SORTS).catch("featured"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type ShopFilters = z.infer<typeof shop_filters_schema>;

// Search params → URL query (defaults dropped), so links stay short and canonical.
export function shopQuery(filters: Partial<ShopFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.size) params.set("size", filters.size);
  if (filters.color) params.set("color", filters.color);
  if (filters.min) params.set("min", String(filters.min));
  if (filters.max) params.set("max", String(filters.max));
  if (filters.in_stock) params.set("in_stock", "1");
  if (filters.sort && filters.sort !== "featured") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
