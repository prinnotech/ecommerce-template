"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminDiscount, DiscountTarget, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import {
  automaticDiscountCode,
  discount_input_schema,
  discount_list_filters_schema,
  type DiscountInput,
  type DiscountListFilters,
} from "@repo/core/lib/schemas/discounts";
import { id_schema } from "@repo/core/lib/schemas/ids";

const PAGE_SIZE = 25;

export type DiscountInputValue = Parameters<typeof discount_input_schema.parse>[0];
// targets = the names of every product and category the discount mentions (its own limit and
// both sides of a Buy X get Y), for the editor's pickers.
export type DiscountView = { discount: AdminDiscount; targets: DiscountTarget[] };

// Automatic discounts are never typed: they get a hidden AUTO-... code.
function withCode(input: DiscountInput): DiscountInput {
  return input.method === "automatic" && !input.code ? { ...input, code: automaticDiscountCode() } : input;
}

export async function getDiscounts(input: Partial<DiscountListFilters>): Promise<ActionResult<Page<AdminDiscount>>> {
  const auth = await authorize("discounts.view", "view discounts");
  if (!auth.ok) return auth;
  const filters = discount_list_filters_schema.parse(input);
  try {
    return ok(await getBackend().discounts.list(filters, PAGE_SIZE, new Date().toISOString()));
  } catch (error) {
    return failFrom(error, "discounts", "getDiscounts");
  }
}

export async function getDiscount(id: string): Promise<ActionResult<DiscountView>> {
  const auth = await authorize("discounts.view", "view a discount");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const backend = getBackend().discounts;
    const discount = await backend.get(id);
    const deal = discount.buy_x_get_y;
    const lists = await Promise.all(
      [discount.applies_to, ...(deal ? [deal.buy.applies_to, deal.get.applies_to] : [])].map((applies_to) =>
        backend.targets(applies_to),
      ),
    );
    const targets = [...new Map(lists.flat().map((target) => [target.id, target])).values()];
    return ok({ discount, targets });
  } catch (error) {
    return failFrom(error, "discounts", "getDiscount");
  }
}

export async function createDiscount(input: DiscountInputValue): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("discounts.edit", "create a discount");
  if (!auth.ok) return auth;
  const parsed = discount_input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const input = withCode(parsed.data);
    const { id } = await getBackend().discounts.create(input);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a discount",
      target_type: "discount",
      target_id: id,
      details: { code: input.code, method: input.method, type: input.type, value: input.value },
    });
    return ok({ id });
  } catch (error) {
    return failFrom(error, "discounts", "createDiscount");
  }
}

export async function updateDiscount(input: { id: string; discount: DiscountInputValue }): Promise<ActionResult<null>> {
  const auth = await authorize("discounts.edit", "edit a discount");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success) return fail("not_found");
  const parsed = discount_input_schema.safeParse(input.discount);
  if (!parsed.success) return fail("invalid_input");
  try {
    await getBackend().discounts.update(input.id, withCode(parsed.data));
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit a discount",
      target_type: "discount",
      target_id: input.id,
      details: { code: parsed.data.code, is_active: parsed.data.is_active },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "discounts", "updateDiscount");
  }
}

export async function deleteDiscount(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("discounts.edit", "delete a discount");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().discounts.delete(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a discount",
      target_type: "discount",
      target_id: id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "discounts", "deleteDiscount");
  }
}
