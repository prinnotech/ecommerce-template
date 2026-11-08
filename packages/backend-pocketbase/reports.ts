import "server-only";

import type { ReportsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { ORDER_ROW_FIELDS, toOrderRows, type OrderRecord } from "@repo/backend-pocketbase/orders";

// PocketBase stores dates as "YYYY-MM-DD HH:MM:SS.sssZ"; filters compare in that format.
const toPocketBaseDate = (iso: string) => iso.replace("T", " ");

export const reports: ReportsBackend = {
  async ordersSince(from) {
    const pb = await createAdminPocketBase();
    return pb.collection("orders").getFullList<OrderRecord>({
      filter: pb.filter('created_at >= {:from} && deleted_at = ""', { from: toPocketBaseDate(from) }),
      fields: "created_at,status,total",
    });
  },

  async countOrdersWithStatus(statuses) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("orders").getList(1, 1, {
      filter: `(${statuses.map((status) => `status = "${status}"`).join(" || ")}) && deleted_at = ""`,
      fields: "id",
    });
    return result.totalItems;
  },

  async codToCollect() {
    const pb = await createAdminPocketBase();
    const unpaid = await pb.collection("orders").getFullList({
      filter:
        'payment_method = "cash_on_delivery" && payment_status = "unpaid" && status != "cancelled" && status != "refunded" && deleted_at = ""',
      fields: "total",
    });
    return unpaid.reduce((sum, order) => sum + order.total, 0);
  },

  async recentOrders(limit) {
    const pb = await createAdminPocketBase();
    const recent = await pb.collection("orders").getList<OrderRecord>(1, limit, {
      filter: 'deleted_at = ""',
      sort: "-created_at",
      fields: ORDER_ROW_FIELDS,
      skipTotal: true,
    });
    return toOrderRows(pb, recent.items);
  },

  async soldItemsSince(from) {
    const pb = await createAdminPocketBase();
    return pb.collection("order_items").getFullList({
      filter: pb.filter(
        'order.created_at >= {:from} && order.status != "cancelled" && order.status != "refunded" && order.deleted_at = ""',
        { from: toPocketBaseDate(from) },
      ),
      fields: "product,title,quantity,line_total",
    });
  },

  async lowStock(threshold, limit) {
    const pb = await createAdminPocketBase();
    const variants = await pb.collection("product_variants").getList(1, limit, {
      filter: pb.filter('stock <= {:low} && is_active = true && product.deleted_at = ""', { low: threshold }),
      sort: "stock",
      expand: "product",
      skipTotal: true,
    });
    type WithProduct = (typeof variants.items)[number] & { expand?: { product?: { title: LocalizedText | null } } };
    return (variants.items as WithProduct[]).map((variant) => ({
      variant_id: variant.id,
      product_id: variant.product,
      product_title: variant.expand?.product?.title ?? {},
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
    }));
  },
  async analyticsOrders(from, to) {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("orders").getFullList<OrderRecord>({
      filter: pb.filter('created_at >= {:from} && created_at < {:to} && deleted_at = ""', {
        from: toPocketBaseDate(from),
        to: toPocketBaseDate(to),
      }),
      fields: "created_at,status,total,refunded_total,discount_total,discount_code,email",
    });
    return rows.map((row) => ({
      created_at: row.created_at,
      status: row.status,
      total: row.total,
      refunded_total: row.refunded_total,
      discount_total: row.discount_total,
      discount_code: row.discount_code,
      email: row.email.toLowerCase(),
    }));
  },

  async analyticsItems(from, to) {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("order_items").getFullList({
      filter: pb.filter(
        'order.created_at >= {:from} && order.created_at < {:to} && order.status != "cancelled" && order.status != "refunded" && order.deleted_at = ""',
        { from: toPocketBaseDate(from), to: toPocketBaseDate(to) },
      ),
      fields: "product,title,quantity,line_total,expand.product.category",
      expand: "product",
    });
    type WithProduct = (typeof rows)[number] & { expand?: { product?: { category?: string } } };
    return (rows as WithProduct[]).map((row) => ({
      product: row.product,
      title: row.title,
      category_id: row.expand?.product?.category ?? "",
      quantity: row.quantity,
      line_total: row.line_total,
    }));
  },

  async emailsWithOrdersBefore(before, emails) {
    if (emails.length === 0) return [];
    const pb = await createAdminPocketBase();
    const found = new Set<string>();
    // Short filters: PocketBase rejects very long ones.
    for (let start = 0; start < emails.length; start += 40) {
      const chunk = emails.slice(start, start + 40);
      const rows = await pb.collection("orders").getFullList({
        filter: `${pb.filter('created_at < {:before} && deleted_at = ""', { before: toPocketBaseDate(before) })} && (${chunk
          .map((email, index) => pb.filter(`email = {:e${index}}`, { [`e${index}`]: email }))
          .join(" || ")})`,
        fields: "email",
      });
      for (const row of rows) found.add(row.email.toLowerCase());
    }
    return [...found];
  },

  async checkoutsBetween(from, to) {
    const pb = await createAdminPocketBase();
    const range = pb.filter("created_at >= {:from} && created_at < {:to}", {
      from: toPocketBaseDate(from),
      to: toPocketBaseDate(to),
    });
    const [started, completed] = await Promise.all([
      pb.collection("checkout_sessions").getList(1, 1, { filter: range, fields: "id" }),
      pb.collection("checkout_sessions").getList(1, 1, { filter: `${range} && status = "completed"`, fields: "id" }),
    ]);
    return { started: started.totalItems, completed: completed.totalItems };
  },
};
