"use server";

import { cookies } from "next/headers";

import { getCustomers } from "@repo/core/actions/customers";
import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { LocalizedText } from "@repo/core/lib/localized";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { ADMIN_LOCALE_COOKIE } from "@repo/core/lib/admin-locale";
import { authorize, callerCan, getCaller } from "@repo/core/lib/auth";
import {
  admin_locale_schema,
  admin_search_schema,
  type AdminLocaleInput,
  type AdminSearchInput,
} from "@repo/core/lib/schemas/admin";

const SEARCH_LIMIT = 5;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type AdminSearchResults = {
  orders: { id: string; order_number: number; customer_name: string; email: string; total: number; currency: string }[];
  products: { id: string; title: LocalizedText; image_url: string }[];
  customers: { key: string; name: string; email: string }[];
};

// The admin's language: saved on the staff profile when signed in (follows them to other devices)
// and in this browser's cookie. Open to signed-out visitors so the sign-in page can switch it too;
// it only ever changes the caller's own preference. Read-only (demo) accounts keep it in the cookie.
export async function setAdminLocale(input: AdminLocaleInput): Promise<ActionResult<null>> {
  const parsed = admin_locale_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  const caller = await getCaller();
  if (caller && !caller.is_read_only) {
    try {
      await getBackend().staff.setLocale(caller.user_id, parsed.data.locale);
    } catch (error) {
      return failFrom(error, "admin", "setAdminLocale");
    }
  }

  const cookie_store = await cookies();
  cookie_store.set(ADMIN_LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return ok(null);
}

// The top bar's search: a few matches per section, only from sections the caller may see.
export async function searchAdmin(input: AdminSearchInput): Promise<ActionResult<AdminSearchResults>> {
  const auth = await authorize("dashboard.view", "search the admin");
  if (!auth.ok) return auth;
  const parsed = admin_search_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const search = parsed.data.query;

  try {
    const backend = getBackend();
    const [orders, products, customers] = await Promise.all([
      callerCan(auth.caller, "orders.view")
        ? backend.orders.list(
            { search, status: "all", payment: "all", sort: "created_at", direction: "desc", page: 1 },
            SEARCH_LIMIT,
          )
        : null,
      callerCan(auth.caller, "products.view")
        ? backend.catalog.listProducts(
            { search, status: "all", category: "", sort: "updated_at", direction: "desc", page: 1 },
            SEARCH_LIMIT,
          )
        : null,
      callerCan(auth.caller, "customers.view") ? getCustomers({ search, type: "all", page: 1 }) : null,
    ]);

    return ok({
      orders: (orders?.items ?? []).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        email: order.email,
        total: order.total,
        currency: order.currency,
      })),
      products: (products?.items ?? []).map((product) => ({
        id: product.id,
        title: product.title,
        image_url: product.image_url,
      })),
      customers:
        customers?.ok === true
          ? customers.data.items
              .slice(0, SEARCH_LIMIT)
              .map((customer) => ({ key: customer.key, name: customer.name, email: customer.email }))
          : [],
    });
  } catch (error) {
    return failFrom(error, "admin", "searchAdmin");
  }
}
