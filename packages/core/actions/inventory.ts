"use server";

import { revalidatePath } from "next/cache";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { InventoryAdjustmentEntry, InventoryRow, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { id_schema } from "@repo/core/lib/schemas/ids";
import {
  adjust_stock_schema,
  inventory_filters_schema,
  type AdjustStockInput,
  type InventoryFilters,
} from "@repo/core/lib/schemas/inventory";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

const PAGE_SIZE = 50;
const HISTORY_SIZE = 50;

export type InventoryPage = Page<InventoryRow> & { low_stock_threshold: number };

export async function getInventory(input: Partial<InventoryFilters>): Promise<ActionResult<InventoryPage>> {
  const auth = await authorize("inventory.view", "view inventory");
  if (!auth.ok) return auth;
  const filters = inventory_filters_schema.parse(input);
  try {
    const settings = await getSiteSettings();
    const page = await getBackend().inventory.list(filters, settings.LOW_STOCK_THRESHOLD, PAGE_SIZE);
    return ok({ ...page, low_stock_threshold: settings.LOW_STOCK_THRESHOLD });
  } catch (error) {
    return failFrom(error, "inventory", "getInventory");
  }
}

export async function adjustStock(input: AdjustStockInput): Promise<ActionResult<{ stock: number }>> {
  const auth = await authorize("inventory.edit", "change stock");
  if (!auth.ok) return auth;
  const parsed = adjust_stock_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const { variant_id, ...change } = parsed.data;
    const result = await getBackend().inventory.adjust(variant_id, { ...change, actor_id: auth.caller.user_id });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change stock",
      target_type: "variant",
      target_id: variant_id,
      details: { before: result.stock_before, after: result.stock_after, reason: change.reason },
    });
    // The store shows "sold out" from stock.
    revalidatePath("/", "layout");
    return ok({ stock: result.stock_after });
  } catch (error) {
    return failFrom(error, "inventory", "adjustStock");
  }
}

export async function getStockHistory(input: {
  variant_id: string;
}): Promise<ActionResult<InventoryAdjustmentEntry[]>> {
  const auth = await authorize("inventory.view", "view stock history");
  if (!auth.ok) return auth;
  const parsed = id_schema.safeParse(input.variant_id);
  if (!parsed.success) return fail("invalid_input");
  try {
    return ok(await getBackend().inventory.history(parsed.data, HISTORY_SIZE));
  } catch (error) {
    return failFrom(error, "inventory", "getStockHistory");
  }
}
