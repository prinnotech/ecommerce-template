import "server-only";

import { sql, type Selectable } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { GiftCard, GiftCardsBackend } from "@repo/core/backend/types";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import type { GiftCardsTable } from "@repo/backend-sql/schema";
import { bool, iso, newId, nowIso } from "@repo/backend-sql/values";

function toCard(row: Selectable<GiftCardsTable>): GiftCard {
  return {
    id: row.id,
    code: row.code,
    initial_value: row.initial_value,
    balance: row.balance,
    currency: row.currency,
    expires_at: iso(row.expires_at),
    is_active: bool(row.is_active),
    customer_email: row.customer_email,
    note: row.note,
    order_id: row.order_id ?? "",
    created_at: iso(row.created_at),
  };
}

export function createGiftCards(ctx: SqlContext): GiftCardsBackend {
  const { db } = ctx;

  return {
    async list(filters, page_size, now) {
      let query = db.selectFrom("gift_cards");
      if (filters.status === "disabled") query = query.where("is_active", "=", false);
      if (filters.status === "expired") query = query.where("is_active", "=", true).where("expires_at", "<", now);
      if (filters.status === "used") {
        query = query
          .where("is_active", "=", true)
          .where("balance", "<=", 0)
          .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">=", now)]));
      }
      if (filters.status === "active") {
        query = query
          .where("is_active", "=", true)
          .where("balance", ">", 0)
          .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">=", now)]));
      }
      if (filters.search) {
        const search = filters.search;
        const code = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
        query = query.where((eb) =>
          eb.or([contains(ctx, "customer_email", search), ...(code ? [contains(ctx, "code", code)] : [])]),
        );
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query.selectAll().orderBy("created_at", "desc").orderBy("id").offset(offset).limit(limit).execute()
          ).map(toCard),
      );
    },

    async get(id) {
      const row = await db.selectFrom("gift_cards").selectAll().where("id", "=", id).executeTakeFirst();
      if (!row) throw new BackendError("not_found");
      const transactions = await db
        .selectFrom("gift_card_transactions")
        .select(["id", "created_at", "amount", "order_id", "note"])
        .where("gift_card_id", "=", id)
        .orderBy("created_at", "desc")
        .execute();
      return {
        ...toCard(row),
        transactions: transactions.map((item) => ({
          id: item.id,
          created_at: iso(item.created_at),
          amount: item.amount,
          order_id: item.order_id ?? "",
          note: item.note,
        })),
      };
    },

    async findByCode(code) {
      const row = await db.selectFrom("gift_cards").selectAll().where("code", "=", code).executeTakeFirst();
      return row ? toCard(row) : null;
    },

    async issue(card) {
      const id = newId();
      await db
        .transaction()
        .execute(async (trx) => {
          await trx
            .insertInto("gift_cards")
            .values({
              id,
              code: card.code,
              initial_value: card.amount,
              balance: card.amount,
              currency: card.currency,
              expires_at: card.expires_at || null,
              is_active: true,
              customer_email: card.customer_email,
              note: card.note,
              order_id: card.order_id || null,
              created_by: card.created_by || null,
            })
            .execute();
          await trx
            .insertInto("gift_card_transactions")
            .values({
              id: newId(),
              gift_card_id: id,
              amount: card.amount,
              order_id: card.order_id || null,
              note: card.note,
            })
            .execute();
        })
        .catch((error: unknown) => {
          if (uniqueViolation(error)?.includes("code")) throw new BackendError("code_taken");
          throw error;
        });
      return { id };
    },

    async setActive(id, is_active) {
      const result = await db
        .updateTable("gift_cards")
        .set({ is_active, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async redeem(id, amount, ref) {
      return db.transaction().execute(async (trx) => {
        const result = await trx
          .updateTable("gift_cards")
          .set({ balance: sql`balance - ${amount}`, updated_at: nowIso() })
          .where("id", "=", id)
          .where("is_active", "=", true)
          .where("balance", ">=", amount)
          .executeTakeFirst();
        if (Number(result.numUpdatedRows) === 0) return false;
        await trx
          .insertInto("gift_card_transactions")
          .values({ id: newId(), gift_card_id: id, amount: -amount, order_id: ref.order_id || null, note: ref.note })
          .execute();
        return true;
      });
    },

    async credit(id, amount, ref) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("gift_cards")
          .set({ balance: sql`balance + ${amount}`, updated_at: nowIso() })
          .where("id", "=", id)
          .execute();
        await trx
          .insertInto("gift_card_transactions")
          .values({ id: newId(), gift_card_id: id, amount, order_id: ref.order_id || null, note: ref.note })
          .execute();
      });
    },

    async countForOrder(order_id) {
      return toCount(
        await db
          .selectFrom("gift_cards")
          .select((eb) => eb.fn.countAll().as("count"))
          .where("order_id", "=", order_id)
          .executeTakeFirst(),
      );
    },
  };
}
