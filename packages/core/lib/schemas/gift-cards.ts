import { z } from "zod";

// Gift cards: a code with a balance, used at checkout (all or part of the total). Sold as
// products marked "gift card" (issued when the order is paid) or issued by staff.

// XXXX-XXXX-XXXX-XXXX, no 0/O or 1/I to mix up.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGiftCardCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(16));
  const chars = Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

// What customers type: spaces, dashes and case don't matter.
export function normalizeGiftCardCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function maskGiftCardCode(code: string): string {
  return `•••• ${normalizeGiftCardCode(code).slice(-4)}`;
}

export const gift_card_code_schema = z
  .string()
  .trim()
  .max(40)
  .transform(normalizeGiftCardCode)
  .pipe(z.string().regex(/^[A-Z0-9]{8,20}$/));

export const issue_gift_card_schema = z.object({
  amount: z.number().int().min(100).max(10_000_000),
  // "" = never.
  expires_at: z.union([z.iso.datetime({ offset: true }), z.literal("")]),
  customer_email: z.union([z.email(), z.literal("")]),
  note: z.string().trim().max(500),
  // Email the code to customer_email (gift_card template).
  is_notify: z.boolean(),
});
export type IssueGiftCardInput = z.infer<typeof issue_gift_card_schema>;

export const gift_card_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "active", "used", "expired", "disabled"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type GiftCardFilters = z.infer<typeof gift_card_filters_schema>;

export type GiftCardStatus = "active" | "used" | "expired" | "disabled";

export function giftCardStatus(
  card: { is_active: boolean; balance: number; expires_at: string },
  now = Date.now(),
): GiftCardStatus {
  if (!card.is_active) return "disabled";
  if (card.expires_at && new Date(card.expires_at).getTime() < now) return "expired";
  if (card.balance <= 0) return "used";
  return "active";
}
