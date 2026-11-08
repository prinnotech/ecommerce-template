"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { DraftLine, DraftOrder, DraftOrderRow, InventoryRow, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { placeSessionOrder } from "@repo/core/lib/checkout/place-order";
import { draftLocale, priceDraft, sendDraftInvoiceEmail, type PricedDraft } from "@repo/core/lib/draft-orders";
import { sendOrderEmails } from "@repo/core/lib/email/order-emails";
import { isSmtpConfigured } from "@repo/core/lib/email/transport";
import { localized } from "@repo/core/lib/localized";
import { allShippingRates } from "@repo/core/lib/shipping";
import {
  complete_draft_schema,
  draft_list_filters_schema,
  save_draft_schema,
  type DraftFields,
  type DraftFieldsInput,
  type DraftListFilters,
} from "@repo/core/lib/schemas/draft-orders";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { SITE_URL } from "@repo/core/lib/site-config";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

const PAGE_SIZE = 25;
// An invoice link stays open for a month.
const INVOICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type DraftOrderView = {
  draft: DraftOrder;
  priced: PricedDraft;
  shipping_rates: { id: string; name: string; price: number }[];
  currency: string;
  // The link the customer got by email ("" until an invoice is sent).
  invoice_url: string;
  order_number: number | null;
  is_smtp_configured: boolean;
};

function invoiceUrl(draft: DraftOrder, settings: SiteSettings): string {
  if (!draft.checkout_session_id) return "";
  return `${SITE_URL}/${draftLocale(draft, settings)}/checkout/${draft.checkout_session_id}`;
}

// Saved lines: the same variant twice becomes one line.
function toLines(draft: DraftFields): DraftLine[] {
  const lines: DraftLine[] = [];
  for (const line of draft.lines) {
    if ("title" in line) {
      lines.push({ variant_id: "", title: line.title, unit_price: line.unit_price, quantity: line.quantity });
      continue;
    }
    const existing = lines.find((item) => item.variant_id === line.variant_id);
    if (existing) existing.quantity = Math.min(existing.quantity + line.quantity, 999);
    else lines.push({ variant_id: line.variant_id, title: "", unit_price: 0, quantity: line.quantity });
  }
  return lines;
}

async function view(draft: DraftOrder, settings: SiteSettings): Promise<DraftOrderView> {
  const locale = draftLocale(draft, settings);
  const [priced, order] = await Promise.all([
    priceDraft(draft, settings),
    draft.order_id
      ? getBackend()
          .orders.get(draft.order_id)
          .catch(() => null)
      : null,
  ]);
  return {
    draft,
    priced,
    shipping_rates: allShippingRates(settings).map((rate) => ({
      id: rate.id,
      name: localized(rate.name, locale) || rate.id,
      price: rate.price,
    })),
    currency: draft.currency || settings.CURRENCY,
    invoice_url: draft.status === "completed" ? "" : invoiceUrl(draft, settings),
    order_number: order?.order_number ?? null,
    is_smtp_configured: isSmtpConfigured(settings.SMTP),
  };
}

export async function getDraftOrders(input: Partial<DraftListFilters>): Promise<ActionResult<Page<DraftOrderRow>>> {
  const auth = await authorize("draft_orders.view", "view draft orders");
  if (!auth.ok) return auth;
  const filters = draft_list_filters_schema.parse(input);
  try {
    return ok(await getBackend().draft_orders.list(filters, PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "draft-orders", "getDraftOrders");
  }
}

export async function getDraftOrder(id: string): Promise<ActionResult<DraftOrderView>> {
  const auth = await authorize("draft_orders.view", "view a draft order");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const [draft, settings] = await Promise.all([getBackend().draft_orders.get(id), getSiteSettings()]);
    return ok(await view(draft, settings));
  } catch (error) {
    return failFrom(error, "draft-orders", "getDraftOrder");
  }
}

export async function createDraftOrder(): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("draft_orders.edit", "create a draft order");
  if (!auth.ok) return auth;
  try {
    const settings = await getSiteSettings();
    const { id } = await getBackend().draft_orders.create(
      {
        user_id: "",
        email: "",
        customer_name: "",
        phone: "",
        locale: settings.DEFAULT_LOCALE,
        lines: [],
        shipping_address: null,
        shipping_method: settings.SHIPPING_RATES[0]?.id ?? "",
        shipping_price: null,
        discount: null,
        note: "",
        total: 0,
        currency: settings.CURRENCY,
      },
      auth.caller.user_id,
    );
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a draft order",
      target_type: "draft_order",
      target_id: id,
    });
    return ok({ id });
  } catch (error) {
    return failFrom(error, "draft-orders", "createDraftOrder");
  }
}

export async function saveDraftOrder(input: {
  id: string;
  draft: DraftFieldsInput;
}): Promise<ActionResult<DraftOrderView>> {
  const auth = await authorize("draft_orders.edit", "edit a draft order");
  if (!auth.ok) return auth;
  const parsed = save_draft_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend().draft_orders;
    const [current, settings] = await Promise.all([backend.get(parsed.data.id), getSiteSettings()]);
    if (current.status === "completed") return fail("draft_completed");
    const fields = { ...parsed.data.draft, lines: toLines(parsed.data.draft) };
    const priced = await priceDraft(fields, settings);
    await backend.update(current.id, { ...fields, total: priced.totals.total, currency: settings.CURRENCY });
    return ok(await view(await backend.get(current.id), settings));
  } catch (error) {
    return failFrom(error, "draft-orders", "saveDraftOrder");
  }
}

export async function deleteDraftOrder(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("draft_orders.edit", "delete a draft order");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const backend = getBackend().draft_orders;
    const draft = await backend.get(id);
    if (draft.status === "completed") return fail("draft_completed");
    if (draft.checkout_session_id)
      await getBackend().checkout.updateSession(draft.checkout_session_id, { status: "expired" });
    await backend.delete(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a draft order",
      target_type: "draft_order",
      target_id: id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "draft-orders", "deleteDraftOrder");
  }
}

// A checkout session holding the draft as priced now, linked to the draft (an older one is closed).
async function openDraftSession(draft: DraftOrder, priced: PricedDraft, settings: SiteSettings, ttl_ms: number) {
  const checkout = getBackend().checkout;
  if (draft.checkout_session_id) await checkout.updateSession(draft.checkout_session_id, { status: "expired" });
  const { is_free_shipping: _is_free_shipping, ...totals } = priced.totals;
  const { id } = await checkout.createSession({
    user: draft.user_id,
    email: draft.email,
    locale: draftLocale(draft, settings),
    line_items: priced.lines,
    ...totals,
    currency: settings.CURRENCY,
    shipping_method: draft.shipping_method || (settings.SHIPPING_RATES[0]?.id ?? ""),
    payment_method: "",
    discount_code: "",
    status: "open",
    expires_at: new Date(Date.now() + ttl_ms).toISOString(),
  });
  await checkout.updateSession(id, {
    shipping_address: draft.shipping_address,
    customer_note: draft.note,
  });
  await getBackend().draft_orders.setInvoiceSession(draft.id, id);
  return id;
}

// Problems that stop a draft from being invoiced or completed.
function draftProblem(draft: DraftOrder, priced: PricedDraft) {
  if (priced.lines.length === 0) return "draft_incomplete" as const;
  if (priced.removed.length > 0 || priced.adjusted.length > 0) return "out_of_stock" as const;
  return null;
}

export async function sendDraftInvoice(id: string): Promise<ActionResult<{ invoice_url: string }>> {
  const auth = await authorize("draft_orders.edit", "send a draft order invoice");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    const [draft, settings] = await Promise.all([getBackend().draft_orders.get(id), getSiteSettings()]);
    if (draft.status === "completed") return fail("draft_completed");
    if (!draft.email) return fail("draft_incomplete");
    if (!isSmtpConfigured(settings.SMTP)) return fail("smtp_failed");
    const priced = await priceDraft(draft, settings);
    const problem = draftProblem(draft, priced);
    if (problem) return fail(problem);

    const session_id = await openDraftSession(draft, priced, settings, INVOICE_TTL_MS);
    const updated = await getBackend().draft_orders.get(id);
    const invoice_url = invoiceUrl(updated, settings);
    const is_sent = await sendDraftInvoiceEmail(updated, priced, settings, invoice_url);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "send a draft order invoice",
      target_type: "draft_order",
      target_id: id,
      details: { session_id, is_sent },
    });
    return is_sent ? ok({ invoice_url }) : fail("smtp_failed");
  } catch (error) {
    return failFrom(error, "draft-orders", "sendDraftInvoice");
  }
}

// "Mark as paid" (money already taken: cash in the shop, bank transfer) or "payment pending":
// the draft becomes a real order now, with the same stock and email rules as the checkout.
export async function completeDraftOrder(input: {
  id: string;
  is_paid: boolean;
}): Promise<ActionResult<{ order_id: string }>> {
  const auth = await authorize("draft_orders.edit", "complete a draft order");
  if (!auth.ok) return auth;
  const parsed = complete_draft_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const [draft, settings] = await Promise.all([backend.draft_orders.get(parsed.data.id), getSiteSettings()]);
    if (draft.status === "completed") return fail("draft_completed");
    if (!draft.email || !draft.shipping_address) return fail("draft_incomplete");
    const priced = await priceDraft(draft, settings);
    const problem = draftProblem(draft, priced);
    if (problem) return fail(problem);

    const session_id = await openDraftSession(draft, priced, settings, 60 * 60 * 1000);
    const session = await backend.checkout.getSession(session_id);
    if (!session) return fail("generic");
    const placed = await placeSessionOrder(
      { ...session, payment_method: "manual", billing_address: draft.shipping_address },
      settings,
      { status: parsed.data.is_paid ? "paid" : "unpaid" },
    );
    if (!placed) return fail("draft_incomplete");
    const order_id = (await backend.orders.getIdByNumber(placed.order_number)) ?? "";
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "complete a draft order",
      target_type: "draft_order",
      target_id: draft.id,
      details: { order_number: placed.order_number, is_paid: parsed.data.is_paid },
    });
    await sendOrderEmails("order_confirmation", placed.order_number);
    return ok({ order_id });
  } catch (error) {
    return failFrom(error, "draft-orders", "completeDraftOrder");
  }
}

// The product picker: variants by product name, SKU, size or colour.
export async function searchDraftVariants(input: { search: string }): Promise<ActionResult<InventoryRow[]>> {
  const auth = await authorize("draft_orders.edit", "search products for a draft order");
  if (!auth.ok) return auth;
  const search = typeof input.search === "string" ? input.search.trim().slice(0, 100) : "";
  try {
    const page = await getBackend().inventory.list({ search, stock: "all", category: "", page: 1 }, 0, 20);
    return ok(page.items.filter((row) => row.is_active));
  } catch (error) {
    return failFrom(error, "draft-orders", "searchDraftVariants");
  }
}

export type DraftCustomer = { id: string; name: string; email: string; phone: string };

// The customer picker: accounts by name or email.
export async function searchDraftCustomers(input: { search: string }): Promise<ActionResult<DraftCustomer[]>> {
  const auth = await authorize("draft_orders.edit", "search customers for a draft order");
  if (!auth.ok) return auth;
  const search = typeof input.search === "string" ? input.search.trim().toLowerCase().slice(0, 100) : "";
  if (search.length < 2) return ok([]);
  try {
    const users = await getBackend().customers.users();
    return ok(
      users
        .filter((user) => user.email.toLowerCase().includes(search) || user.name.toLowerCase().includes(search))
        .slice(0, 10)
        .map((user) => ({ id: user.id, name: user.name, email: user.email, phone: user.phone })),
    );
  } catch (error) {
    return failFrom(error, "draft-orders", "searchDraftCustomers");
  }
}
