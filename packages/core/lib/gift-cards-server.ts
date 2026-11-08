import "server-only";

import { getBackend } from "@repo/core/backend/index";
import type { AdminOrderDetail, GiftCard } from "@repo/core/backend/types";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import { buildOrderEmail } from "@repo/core/lib/email/order-emails";
import { sendEmail } from "@repo/core/lib/email/transport";
import { generateGiftCardCode, giftCardStatus, normalizeGiftCardCode } from "@repo/core/lib/schemas/gift-cards";
import { reportError } from "@repo/core/lib/server-log";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { formatCurrency, formatDate } from "@repo/core/lib/utils/format";

// Gift cards bought in the store last a year (Shopify's default; staff-issued ones choose).
const PURCHASED_VALIDITY_DAYS = 365;

// A card that can pay now: active, not expired, money left, same currency as the store.
export async function findUsableGiftCard(code: string, settings: SiteSettings): Promise<GiftCard | null> {
  const normalized = normalizeGiftCardCode(code);
  if (normalized.length < 8) return null;
  const card = await getBackend().gift_cards.findByCode(normalized);
  if (!card || giftCardStatus(card) !== "active") return null;
  if (card.currency && card.currency !== settings.CURRENCY) return null;
  return card;
}

// A code that is a gift card, but used up, expired, switched off or in another currency (so the
// checkout can say so instead of "invalid code").
export async function isUnusableGiftCard(code: string, settings: SiteSettings): Promise<boolean> {
  const normalized = normalizeGiftCardCode(code);
  if (normalized.length < 8) return false;
  const card = await getBackend().gift_cards.findByCode(normalized);
  return Boolean(card) && !(await findUsableGiftCard(code, settings));
}

// A new card with a fresh code (a clash with an existing code is retried).
export async function issueGiftCard(input: {
  amount: number;
  expires_at: string;
  customer_email: string;
  note: string;
  order_id: string;
  created_by: string;
  currency: string;
}): Promise<{ id: string; code: string }> {
  for (let attempt = 1; ; attempt++) {
    const code = normalizeGiftCardCode(generateGiftCardCode());
    try {
      const { id } = await getBackend().gift_cards.issue({ ...input, code });
      return { id, code };
    } catch (error) {
      if (attempt >= 5) throw error;
    }
  }
}

function codeForPeople(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

// The gift card email (Settings → Notifications), shaped like an order email without the items.
export async function sendGiftCardEmail(
  card: { code: string; balance: number; expires_at: string; customer_email: string },
  options: { to: string; customer_name: string; locale: string },
): Promise<boolean> {
  const settings = await getSiteSettings();
  const locale: Locale = isLocale(options.locale)
    ? options.locale
    : isLocale(settings.DEFAULT_LOCALE)
      ? settings.DEFAULT_LOCALE
      : LOCALES[0];
  const placeholder_order: AdminOrderDetail = {
    id: "",
    order_number: 0,
    created_at: new Date().toISOString(),
    status: "pending",
    payment_status: "unpaid",
    payment_method: "",
    email: options.to,
    phone: "",
    locale,
    shipping_address: null,
    billing_address: null,
    shipping_method: "",
    customer_note: "",
    internal_note: "",
    attribution: null,
    refunded_total: 0,
    refunds: [],
    gift_card_total: 0,
    checkout_session_id: "",
    tracking_number: "",
    carrier: "",
    tracking_url: "",
    paid_at: "",
    shipped_at: "",
    delivered_at: "",
    cancelled_at: "",
    items: [],
    events: [],
    payments: [],
    customer: null,
    discount_code: "",
    currency: settings.CURRENCY,
    subtotal: 0,
    discount_total: 0,
    shipping_total: 0,
    tax_total: 0,
    cod_fee: 0,
    total: 0,
  };
  const email = await buildOrderEmail("gift_card", placeholder_order, {
    to: options.to,
    locale,
    extra: {
      customer_name: options.customer_name,
      gift_card_code: codeForPeople(card.code),
      gift_card_balance: formatCurrency(card.balance, settings.CURRENCY, locale),
      gift_card_expires: card.expires_at ? formatDate(card.expires_at, locale) : "",
    },
  });
  if (!email) return false;
  return (await sendEmail({ ...email, template: "gift_card", order_id: "" })).ok;
}

// Once a paid order holds gift card products: one card per unit, emailed to the buyer.
// Safe to call twice (an order that already issued its cards is skipped).
export async function issueGiftCardsForOrder(order_id: string): Promise<number> {
  try {
    const backend = getBackend();
    if ((await backend.gift_cards.countForOrder(order_id)) > 0) return 0;
    const order = await backend.orders.get(order_id);
    if (order.payment_status !== "paid") return 0;
    const products = await Promise.all(
      [...new Set(order.items.map((item) => item.product).filter(Boolean))].map((id) =>
        backend.catalog.getProduct(id).catch(() => null),
      ),
    );
    const gift_ids = new Set(products.filter((product) => product?.is_gift_card).map((product) => product?.id));
    const expires_at = new Date(Date.now() + PURCHASED_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let issued = 0;
    for (const item of order.items.filter((line) => gift_ids.has(line.product))) {
      for (let unit = 0; unit < item.quantity; unit++) {
        const card = await issueGiftCard({
          amount: item.unit_price,
          expires_at,
          customer_email: order.email,
          note: `#${order.order_number}`,
          order_id: order.id,
          created_by: "",
          currency: order.currency,
        });
        issued++;
        await sendGiftCardEmail(
          { code: card.code, balance: item.unit_price, expires_at, customer_email: order.email },
          { to: order.email, customer_name: order.shipping_address?.full_name ?? "", locale: order.locale },
        );
      }
    }
    return issued;
  } catch (error) {
    await reportError("gift-cards", `issue for order ${order_id}`, error);
    return 0;
  }
}
