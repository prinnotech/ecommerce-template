import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";

// Products → Inventory: one row per variant, with stock edited in place.

export const STOCK_FILTERS = ["all", "low", "out"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export const inventory_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  stock: z.enum(STOCK_FILTERS).catch("all"),
  category: z.union([id_schema, z.literal("")]).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type InventoryFilters = z.infer<typeof inventory_filters_schema>;

// Why stock changed. "order", "refund" and "draft_order" are written by the system, the rest by staff.
export const ADJUSTMENT_REASONS = ["received", "correction", "damaged", "returned", "other"] as const;
export const SYSTEM_REASONS = ["order", "restock", "draft_order"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number] | (typeof SYSTEM_REASONS)[number];

export const MAX_STOCK = 1_000_000;

export const adjust_stock_schema = z
  .object({
    variant_id: id_schema,
    // "set" = the new stock; "add" = a change (negative removes).
    mode: z.enum(["set", "add"]),
    quantity: z.number().int().min(-MAX_STOCK).max(MAX_STOCK),
    reason: z.enum(ADJUSTMENT_REASONS),
    note: z.string().trim().max(500).catch(""),
  })
  .refine((input) => input.mode === "add" || input.quantity >= 0, { path: ["quantity"] });
export type AdjustStockInput = z.input<typeof adjust_stock_schema>;
