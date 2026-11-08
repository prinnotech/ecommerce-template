import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { GiftCard, GiftCardsBackend } from "@repo/core/backend/types";
import type { GiftCardFilters } from "@repo/core/lib/schemas/gift-cards";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { GiftCardsResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

const pbDate = (iso: string) => iso.replace("T", " ");

function toCard(record: GiftCardsResponse): GiftCard {
  return {
    id: record.id,
    code: record.code,
    initial_value: record.initial_value,
    balance: record.balance,
    currency: record.currency,
    expires_at: record.expires_at,
    is_active: record.is_active,
    customer_email: record.customer_email,
    note: record.note,
    order_id: record.order,
    created_at: record.created_at,
  };
}

function buildFilter(pb: TypedPocketBase, filters: GiftCardFilters, now: string): string {
  const parts: string[] = [];
  const not_expired = pb.filter('(expires_at = "" || expires_at >= {:now})', { now: pbDate(now) });
  if (filters.status === "disabled") parts.push("is_active = false");
  if (filters.status === "expired")
    parts.push(pb.filter('is_active = true && expires_at != "" && expires_at < {:now}', { now: pbDate(now) }));
  if (filters.status === "used") parts.push(`is_active = true && balance <= 0 && ${not_expired}`);
  if (filters.status === "active") parts.push(`is_active = true && balance > 0 && ${not_expired}`);
  if (filters.search) {
    const code = filters.search.toUpperCase().replace(/[^A-Z0-9]/g, "");
    parts.push(
      code
        ? pb.filter("(customer_email ~ {:search} || code ~ {:code})", { search: filters.search, code })
        : pb.filter("customer_email ~ {:search}", { search: filters.search }),
    );
  }
  return parts.join(" && ");
}

export const gift_cards: GiftCardsBackend = {
  async list(filters, page_size, now) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("gift_cards").getList(filters.page, page_size, {
      filter: buildFilter(pb, filters, now),
      sort: "-created_at,id",
    });
    return {
      items: result.items.map(toCard),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("gift_cards")
      .getOne(id)
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
        throw error;
      });
    const transactions = await pb.collection("gift_card_transactions").getFullList({
      filter: pb.filter("gift_card = {:id}", { id }),
      sort: "-created_at",
    });
    return {
      ...toCard(record),
      transactions: transactions.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        amount: item.amount,
        order_id: item.order_id,
        note: item.note,
      })),
    };
  },

  async findByCode(code) {
    const pb = await createAdminPocketBase();
    const result = await pb
      .collection("gift_cards")
      .getList(1, 1, { filter: pb.filter("code = {:code}", { code }), skipTotal: true });
    return result.items[0] ? toCard(result.items[0]) : null;
  },

  async issue(card) {
    const pb = await createAdminPocketBase();
    try {
      const record = await pb.collection("gift_cards").create({
        code: card.code,
        initial_value: card.amount,
        balance: card.amount,
        currency: card.currency,
        expires_at: card.expires_at,
        is_active: true,
        customer_email: card.customer_email,
        note: card.note,
        order: card.order_id,
        created_by: card.created_by,
      });
      await pb.collection("gift_card_transactions").create({
        gift_card: record.id,
        amount: card.amount,
        order_id: card.order_id,
        note: card.note,
      });
      return { id: record.id };
    } catch (error) {
      if (pocketBaseFieldCode(error, "code") === "validation_not_unique") throw new BackendError("code_taken");
      throw error;
    }
  },

  async setActive(id, is_active) {
    const pb = await createAdminPocketBase();
    await pb
      .collection("gift_cards")
      .update(id, { is_active })
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
        throw error;
      });
  },

  // The balance field's min 0 makes the batch fail if the card doesn't have enough left.
  async redeem(id, amount, ref) {
    const pb = await createAdminPocketBase();
    const card = await pb
      .collection("gift_cards")
      .getOne(id, { fields: "id,is_active,balance" })
      .catch(() => null);
    if (!card?.is_active || card.balance < amount) return false;
    const batch = pb.createBatch();
    batch.collection("gift_cards").update(id, { "balance-": amount });
    batch
      .collection("gift_card_transactions")
      .create({ gift_card: id, amount: -amount, order_id: ref.order_id, note: ref.note });
    try {
      await batch.send();
      return true;
    } catch {
      // Spent elsewhere in the meantime (balance would go below 0).
      return false;
    }
  },

  async credit(id, amount, ref) {
    const pb = await createAdminPocketBase();
    const batch = pb.createBatch();
    batch.collection("gift_cards").update(id, { "balance+": amount });
    batch
      .collection("gift_card_transactions")
      .create({ gift_card: id, amount, order_id: ref.order_id, note: ref.note });
    await batch.send();
  },

  async countForOrder(order_id) {
    const pb = await createAdminPocketBase();
    const result = await pb
      .collection("gift_cards")
      .getList(1, 1, { filter: pb.filter("order = {:id}", { id: order_id }), fields: "id" });
    return result.totalItems;
  },
};
