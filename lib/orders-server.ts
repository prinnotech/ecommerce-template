import "server-only";

import type { OrderStatus, PaymentStatus } from "@/lib/orders";
import type { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import type { AddressFields } from "@/lib/schemas/account";
import type { OrdersResponse } from "@/types/pocketbase-types";

// Server-only helpers shared by the orders and dashboard actions. They take a PocketBase
// client, so they must never live in a "use server" file (every export there is an endpoint).

export type OrderRecord = OrdersResponse<unknown, AddressFields | null, AddressFields | null>;
type AdminPocketBase = Awaited<ReturnType<typeof createAdminPocketBase>>;

export type AdminOrderRow = {
  id: string;
  order_number: number;
  created_at: string;
  customer_name: string;
  email: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  total: number;
  currency: string;
  item_count: number;
};

export const ORDER_ROW_FIELDS =
  "id,order_number,created_at,shipping_address,email,status,payment_status,payment_method,total,currency";

export function customerName(order: Pick<OrderRecord, "shipping_address" | "email">): string {
  return order.shipping_address?.full_name || order.email;
}

async function itemCounts(pb: AdminPocketBase, order_ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (order_ids.length === 0) return counts;
  const items = await pb.collection("order_items").getFullList({
    filter: order_ids.map((id, index) => pb.filter(`order = {:o${index}}`, { [`o${index}`]: id })).join(" || "),
    fields: "order,quantity",
  });
  for (const item of items) counts.set(item.order, (counts.get(item.order) ?? 0) + item.quantity);
  return counts;
}

export async function toOrderRows(pb: AdminPocketBase, orders: OrderRecord[]): Promise<AdminOrderRow[]> {
  const counts = await itemCounts(
    pb,
    orders.map((order) => order.id),
  );
  return orders.map((order) => ({
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    customer_name: customerName(order),
    email: order.email,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    total: order.total,
    currency: order.currency,
    item_count: counts.get(order.id) ?? 0,
  }));
}
