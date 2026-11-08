"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderRow } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import {
  customer_key_schema,
  customer_list_filters_schema,
  customer_marketing_schema,
  customer_note_schema,
  type CustomerListFilters,
  type CustomerMarketingInput,
  type CustomerNoteInput,
} from "@repo/core/lib/schemas/customers";

const PAGE_SIZE = 25;
// Orders that never turned into revenue don't count towards "total spent".
const NOT_SPENT = new Set(["cancelled", "refunded"]);

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
};

export type AdminCustomerPage = {
  items: AdminCustomerRow[];
  page: number;
  total_pages: number;
  total_items: number;
};

export type AdminCustomer = AdminCustomerRow & {
  is_verified: boolean;
  first_order_at: string;
  average_order: number;
  addresses: (AddressFields & { is_default: boolean })[];
  orders: AdminOrderRow[];
};

// Registered users plus guests (orders without a user, grouped by email), with their order stats.
// Built in memory: one query per collection is far cheaper than one per customer, and a store's
// customer list stays in the thousands.
async function buildCustomers(): Promise<AdminCustomerRow[]> {
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
      });
    }
    const customer = customers.get(key)!;
    customer.order_count += 1;
    if (!NOT_SPENT.has(order.status)) customer.total_spent += order.total;
    customer.currency ||= order.currency;
    customer.last_order_at = order.created_at;
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

const SORT_VALUE: Record<CustomerListFilters["sort"], (customer: AdminCustomerRow) => string | number> = {
  last_order: (customer) => customer.last_order_at,
  total_spent: (customer) => customer.total_spent,
  order_count: (customer) => customer.order_count,
  created_at: (customer) => customer.created_at,
};

function matchesType(customer: AdminCustomerRow, type: CustomerListFilters["type"]): boolean {
  if (type === "registered") return customer.is_registered;
  if (type === "guest") return !customer.is_registered;
  if (type === "subscribed") return customer.accepts_marketing;
  return true;
}

export async function getCustomers(input: Partial<CustomerListFilters>): Promise<ActionResult<AdminCustomerPage>> {
  const auth = await authorize("customers.view", "view customers");
  if (!auth.ok) return auth;
  const filters = customer_list_filters_schema.parse(input);

  try {
    const search = filters.search.toLowerCase();
    const matching = (await buildCustomers()).filter(
      (customer) =>
        matchesType(customer, filters.type) &&
        (!search ||
          [customer.name, customer.email, customer.phone].some((value) => value.toLowerCase().includes(search))),
    );
    const value = SORT_VALUE[filters.sort];
    const sign = filters.direction === "asc" ? 1 : -1;
    // Stable: ties keep the default order (latest order first).
    matching.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === right) return 0;
      return (left < right ? -1 : 1) * sign;
    });
    const total_pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const page = Math.min(filters.page, total_pages);
    return ok({
      items: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      page,
      total_pages,
      total_items: matching.length,
    });
  } catch (error) {
    return failFrom(error, "customers", "getCustomers");
  }
}

export async function getCustomer(key: string): Promise<ActionResult<AdminCustomer>> {
  const auth = await authorize("customers.view", "view a customer");
  if (!auth.ok) return auth;
  if (!customer_key_schema.safeParse(key).success) return fail("not_found");

  try {
    const backend = getBackend().customers;
    const customer = (await buildCustomers()).find((row) => row.key === key);
    if (!customer) return fail("not_found");

    // Same rule as the list: the user's own orders plus guest orders placed with their email.
    const [orders, saved_addresses, users] = await Promise.all([
      backend.ordersOf({ user_id: customer.is_registered ? customer.key : null, email: customer.email }),
      customer.is_registered ? backend.savedAddresses(customer.key) : Promise.resolve([]),
      customer.is_registered ? backend.users() : Promise.resolve([]),
    ]);
    const shipping_addresses = customer.is_registered
      ? []
      : (await backend.orderRecords())
          .filter((order) => !order.user && order.email.toLowerCase() === customer.email.toLowerCase())
          .map((order) => order.shipping_address)
          .filter((address): address is AddressFields => Boolean(address));

    // Guests have no address book: show the distinct addresses they shipped to.
    const addresses: AdminCustomer["addresses"] =
      saved_addresses.length > 0
        ? saved_addresses.map(({ id: _id, ...address }) => address)
        : [
            ...new Map(
              shipping_addresses.map((address) => [
                // Compare what's printed: stored copies can differ in key order or empty extras.
                [address.full_name, address.line1, address.line2, address.postal_code, address.city, address.country]
                  .map((part) => (part ?? "").trim().toLowerCase())
                  .join("|"),
                { ...address, is_default: false },
              ]),
            ).values(),
          ];

    const spent_orders = orders.filter((order) => !NOT_SPENT.has(order.status));
    return ok({
      ...customer,
      is_verified: Boolean(users.find((user) => user.id === customer.key)?.verified),
      first_order_at: orders.at(-1)?.created_at ?? "",
      average_order: spent_orders.length > 0 ? Math.round(customer.total_spent / spent_orders.length) : 0,
      addresses,
      orders,
    });
  } catch (error) {
    return failFrom(error, "customers", "getCustomer");
  }
}

// Notes are stored per registered user id, or per email for a guest (a guest's key changes with
// their latest order, their email doesn't).
async function noteKey(key: string): Promise<string | null> {
  if (!key.startsWith("g")) return key;
  const customer = (await buildCustomers()).find((row) => row.key === key);
  return customer ? `email:${customer.email.toLowerCase()}` : null;
}

export async function getCustomerNote(key: string): Promise<ActionResult<string>> {
  const auth = await authorize("customers.view", "view a customer note");
  if (!auth.ok) return auth;
  if (!customer_key_schema.safeParse(key).success) return fail("not_found");

  try {
    const note_key = await noteKey(key);
    if (!note_key) return fail("not_found");
    return ok(await getBackend().customers.getNote(note_key));
  } catch (error) {
    return failFrom(error, "customers", "getCustomerNote");
  }
}

export async function updateCustomerNote(input: CustomerNoteInput): Promise<ActionResult<null>> {
  const auth = await authorize("customers.edit", "edit a customer note");
  if (!auth.ok) return auth;
  const parsed = customer_note_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const note_key = await noteKey(parsed.data.key);
    if (!note_key) return fail("not_found");
    await getBackend().customers.setNote(note_key, parsed.data.note, auth.caller.user_id);
    return ok(null);
  } catch (error) {
    return failFrom(error, "customers", "updateCustomerNote");
  }
}

// Staff record consent the customer gave elsewhere (in the shop, by phone). Logged.
export async function setCustomerMarketing(input: CustomerMarketingInput): Promise<ActionResult<null>> {
  const auth = await authorize("customers.edit", "change marketing consent");
  if (!auth.ok) return auth;
  const parsed = customer_marketing_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await getBackend().customers.setAcceptsMarketing(parsed.data.user_id, parsed.data.accepts_marketing);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change marketing consent",
      target_type: "users",
      target_id: parsed.data.user_id,
      details: { accepts_marketing: parsed.data.accepts_marketing },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "customers", "setCustomerMarketing");
  }
}
