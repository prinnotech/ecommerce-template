import "server-only";

import { getBackend } from "@repo/core/backend/index";

// Orders that never turned into revenue don't count towards "total spent".
export const NOT_SPENT = new Set(["cancelled", "refunded"]);

export type AdminCustomerRow = {
  key: string;
  name: string;
  email: string;
  phone: string;
  is_registered: boolean;
  order_count: number;
  total_spent: number;
  currency: string;
  last_order_at: string;
  created_at: string;
  accepts_marketing: boolean;
  // From the latest order: its delivery country and the language it was placed in ("" if none).
  country: string;
  locale: string;
};

// Registered users plus guests (orders without a user, grouped by email), with their order stats.
// Built in memory: one query per collection is far cheaper than one per customer, and a store's
// customer list stays in the thousands.
export async function buildCustomers(): Promise<AdminCustomerRow[]> {
  const backend = getBackend();
  const [users, orders, staff] = await Promise.all([
    backend.customers.users(),
    backend.customers.orderRecords(),
    backend.staff.listMembers(),
  ]);
  const staff_ids = new Set(staff.map((member) => member.user_id));

  const customers = new Map<string, AdminCustomerRow>();
  const key_by_email = new Map<string, string>();
  for (const user of users) {
    customers.set(user.id, {
      key: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      is_registered: true,
      order_count: 0,
      total_spent: 0,
      currency: "",
      last_order_at: "",
      created_at: user.created_at,
      accepts_marketing: user.accepts_marketing,
      country: "",
      locale: "",
    });
    key_by_email.set(user.email.toLowerCase(), user.id);
  }

  for (const order of orders) {
    const email = order.email.toLowerCase();
    // A guest order placed with a registered user's email belongs to that user.
    let key = (order.user && customers.has(order.user) ? order.user : "") || key_by_email.get(email) || "";
    if (!key) {
      key = `g${order.id}`;
      key_by_email.set(email, key);
      customers.set(key, {
        key,
        name: order.shipping_address?.full_name ?? "",
        email: order.email,
        phone: order.shipping_address?.phone ?? "",
        is_registered: false,
        order_count: 0,
        total_spent: 0,
        currency: order.currency,
        last_order_at: "",
        created_at: order.created_at,
        accepts_marketing: false,
        country: "",
        locale: "",
      });
    }
    const customer = customers.get(key)!;
    customer.order_count += 1;
    if (!NOT_SPENT.has(order.status)) customer.total_spent += order.total;
    customer.currency ||= order.currency;
    customer.last_order_at = order.created_at;
    customer.country = order.shipping_address?.country || customer.country;
    customer.locale = order.locale || customer.locale;
    customer.name ||= order.shipping_address?.full_name ?? "";
    customer.phone ||= order.shipping_address?.phone ?? "";
  }

  // Staff accounts aren't customers, unless they bought something in the shop.
  return [...customers.values()]
    .filter((customer) => !staff_ids.has(customer.key) || customer.order_count > 0)
    .sort(
      (a, b) =>
        (b.last_order_at || "").localeCompare(a.last_order_at || "") || b.created_at.localeCompare(a.created_at),
    );
}
