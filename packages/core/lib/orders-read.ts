import "server-only";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, AdminOrderRow, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { authorize } from "@repo/core/lib/auth";
import { order_id_input_schema, order_list_filters_schema, type OrderListFilters } from "@repo/core/lib/schemas/orders";

export type AdminOrderPage = Page<AdminOrderRow>;
const PAGE_SIZE = 25;

// The admin's order reads, shared by Server Components (called directly) and the actions in
// actions/orders.ts (which wrap them for TanStack Query in the browser). Authorized here, so
// both paths check the same permission.
export async function readAdminOrders(input: Partial<OrderListFilters>): Promise<ActionResult<AdminOrderPage>> {
  const auth = await authorize("orders.view", "view orders");
  if (!auth.ok) return auth;
  const filters = order_list_filters_schema.parse(input);

  try {
    return ok(await getBackend().orders.list(filters, PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "orders", "readAdminOrders");
  }
}

export async function readAdminOrder(id: string): Promise<ActionResult<AdminOrderDetail>> {
  const auth = await authorize("orders.view", "view an order");
  if (!auth.ok) return auth;
  if (!order_id_input_schema.safeParse({ id }).success) return fail("not_found");

  try {
    return ok(await getBackend().orders.get(id));
  } catch (error) {
    return failFrom(error, "orders", "readAdminOrder");
  }
}
