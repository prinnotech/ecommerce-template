import "server-only";

import { randomBytes } from "node:crypto";

import type { CheckoutBackend, CheckoutSession } from "@repo/core/backend/types";
import { BackendError } from "@repo/core/backend/errors";
import type { PricedLine } from "@repo/core/lib/checkout/checkout-server";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import { createAdminPocketBase, createPublicPocketBase } from "@repo/backend-pocketbase/client";
import { getFileUrl } from "@repo/backend-pocketbase/files";
import type {
  CheckoutSessionsResponse,
  DiscountCodesResponse,
  ProductsResponse,
  ProductVariantsResponse,
} from "@repo/backend-pocketbase/pocketbase-types";
import { reportError } from "@repo/core/lib/server-log";
import { toDiscountCode } from "@repo/backend-pocketbase/discounts";
import { parseAttribution } from "@repo/core/lib/tracking/attribution";

// Checkout sessions, payments and discount codes are locked in PocketBase (superuser client
// only). Possessing the session id is what authorizes access to that one session.

// Generic order follows the generated type: description, image_colors, tags, title.
type ProductRecord = ProductsResponse<LocalizedText, Record<string, string>, string[], LocalizedText>;
type VariantWithProduct = ProductVariantsResponse<{ product?: ProductRecord }>;
type SessionRecord = CheckoutSessionsResponse<unknown, AddressFields | null, PricedLine[], AddressFields | null>;

// PocketBase-style id (15 chars, a-z0-9), so batch requests can reference records created in the same batch.
function newRecordId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...randomBytes(15)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function toSession(record: SessionRecord): CheckoutSession {
  return {
    id: record.id,
    user: record.user,
    email: record.email,
    locale: record.locale,
    line_items: record.line_items ?? [],
    currency: record.currency,
    subtotal: record.subtotal,
    discount_total: record.discount_total,
    shipping_total: record.shipping_total,
    tax_total: record.tax_total,
    cod_fee: record.cod_fee,
    total: record.total,
    shipping_method: record.shipping_method,
    payment_method: record.payment_method,
    discount_code: record.discount_code,
    status: record.status,
    expires_at: record.expires_at,
    shipping_address: record.shipping_address ?? null,
    billing_address: record.billing_address ?? null,
    customer_note: record.customer_note ?? "",
    attribution: record.attribution ? parseAttribution(record.attribution) : null,
    gift_card_id: record.gift_card_id ?? "",
    gift_card_amount: record.gift_card_amount ?? 0,
  };
}

export const checkout: CheckoutBackend = {
  // The public client, so hidden products and inactive variants never come back.
  async pricingVariants(variant_ids) {
    const pb = createPublicPocketBase();
    const variants = await pb.collection("product_variants").getFullList<VariantWithProduct>({
      filter: variant_ids.map((id, index) => pb.filter(`id = {:v${index}}`, { [`v${index}`]: id })).join(" || "),
      expand: "product",
    });
    return variants.flatMap((variant) => {
      const product = variant.expand?.product;
      if (!product) return [];
      const first_image = product.images?.[0];
      return [
        {
          variant_id: variant.id,
          product_id: product.id,
          slug: product.slug,
          title: product.title ?? {},
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          image: first_image ? getFileUrl(product, first_image, "100x100") : "",
          price_override: variant.price_override,
          product_price: product.price,
          compare_at_price: product.compare_at_price,
          stock: variant.stock,
        },
      ];
    });
  },

  async findDiscount(code) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("discount_codes")
      .getFirstListItem<DiscountCodesResponse<unknown>>(pb.filter("code = {:code}", { code }))
      .catch(() => null);
    if (!record || record.deleted_at) return null;
    return toDiscountCode(record);
  },

  async getDiscountCode(id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("discount_codes")
      .getOne(id, { fields: "code" })
      .catch(() => null);
    return record?.code ?? null;
  },

  async createSession(session) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("checkout_sessions").create(session);
    return { id: record.id };
  },

  async getSession(id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("checkout_sessions")
      .getOne<SessionRecord>(id)
      .catch(() => null);
    return record ? toSession(record) : null;
  },

  async updateSession(id, patch) {
    const pb = await createAdminPocketBase();
    await pb.collection("checkout_sessions").update(id, patch);
  },

  async recordFailedPayment(payment) {
    const pb = await createAdminPocketBase();
    await pb.collection("payments").create({
      checkout_session: payment.session_id,
      provider: "card",
      amount: payment.amount,
      currency: payment.currency,
      status: "failed",
      error_code: payment.error_code,
    });
  },

  // One atomic batch. A stock decrement below zero fails the stock field's min: 0 rule,
  // which rolls the whole batch back.
  async placeOrder(order, lines, session_patch) {
    const pb = await createAdminPocketBase();
    const order_id = newRecordId();
    // Stock before the order, for the inventory history written after it.
    const variant_ids = [...new Set(lines.map((line) => line.variant_id).filter(Boolean))];
    const stock_before = new Map(
      (variant_ids.length > 0
        ? await pb.collection("product_variants").getFullList({
            filter: variant_ids.map((id, index) => pb.filter(`id = {:v${index}}`, { [`v${index}`]: id })).join(" || "),
            fields: "id,stock",
          })
        : []
      ).map((variant) => [variant.id, variant.stock]),
    );
    const batch = pb.createBatch();
    const { payment, ...order_fields } = order;
    batch.collection("orders").create({ id: order_id, ...order_fields });
    for (const line of lines) {
      batch.collection("order_items").create({
        order: order_id,
        product: line.product_id,
        variant: line.variant_id,
        title: line.title,
        variant_label: line.variant_label,
        sku: line.sku,
        image: line.image,
        unit_price: line.unit_price,
        quantity: line.quantity,
        line_total: line.line_total,
      });
      // Custom lines (draft orders) have no variant and no stock.
      if (line.variant_id) batch.collection("product_variants").update(line.variant_id, { "stock-": line.quantity });
    }
    batch.collection("order_events").create({ order: order_id, type: "created", is_customer_visible: true });
    batch.collection("payments").create({
      order: order_id,
      checkout_session: order.checkout_session,
      provider: order.payment_method,
      provider_ref: payment?.provider_ref ?? "",
      amount: order.total - (order.gift_card_total ?? 0),
      currency: order.currency,
      status: payment?.status ?? "pending",
    });
    if (order.discount_code) batch.collection("discount_codes").update(order.discount_code, { "used_count+": 1 });
    batch.collection("checkout_sessions").update(order.checkout_session, { ...session_patch, status: "completed" });

    try {
      await batch.send();
    } catch (error) {
      // Most likely someone bought the last units between the stock check and the batch.
      await reportError("checkout", "placeOrder batch", error);
      throw new BackendError("out_of_stock");
    }
    const created = await pb.collection("orders").getOne(order_id, { fields: "order_number" });
    // The order number is only known now, so the history rows follow the order in a second batch.
    // They are a log: failing to write them never undoes the order.
    try {
      const log = pb.createBatch();
      for (const line of lines) {
        if (!line.variant_id || !stock_before.has(line.variant_id)) continue;
        log.collection("inventory_adjustments").create({
          variant: line.variant_id,
          delta: -line.quantity,
          stock_after: Math.max(0, (stock_before.get(line.variant_id) ?? 0) - line.quantity),
          reason: "order",
          note: `#${created.order_number}`,
          actor_id: "",
        });
      }
      if (variant_ids.length > 0) await log.send();
    } catch (error) {
      await reportError("checkout", "placeOrder stock history", error);
    }
    return { order_number: created.order_number };
  },

  async orderForSession(session_id) {
    const pb = await createAdminPocketBase();
    const order = await pb
      .collection("orders")
      .getFirstListItem(pb.filter("checkout_session = {:id}", { id: session_id }))
      .catch(() => null);
    if (!order) return null;
    return {
      order_number: order.order_number,
      email: order.email,
      status: order.status,
      payment_method: order.payment_method,
      currency: order.currency,
      subtotal: order.subtotal,
      discount_total: order.discount_total,
      shipping_total: order.shipping_total,
      tax_total: order.tax_total,
      cod_fee: order.cod_fee,
      total: order.total,
      gift_card_total: order.gift_card_total,
      shipping_address: (order.shipping_address as AddressFields | null) ?? null,
      shipping_method: order.shipping_method,
      user: order.user,
    };
  },
};
