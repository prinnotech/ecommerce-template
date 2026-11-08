import "server-only";

import type { ExpressionBuilder, Selectable } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminDiscount, DiscountCode, DiscountsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import { APPLIES_TO_ALL, applies_to_schema, type DiscountInput } from "@repo/core/lib/schemas/discounts";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import type { Database, DiscountCodesTable } from "@repo/backend-sql/schema";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

type Row = Selectable<DiscountCodesTable>;

export function toDiscountCode(row: Row): DiscountCode {
  return {
    id: row.id,
    code: row.code,
    type: row.type as DiscountCode["type"],
    value: row.value,
    min_subtotal: row.min_subtotal,
    starts_at: iso(row.starts_at),
    ends_at: iso(row.ends_at),
    usage_limit: row.usage_limit,
    used_count: row.used_count,
    is_active: bool(row.is_active),
    title: row.title,
    applies_to: applies_to_schema.catch(APPLIES_TO_ALL).parse(json(row.applies_to, APPLIES_TO_ALL)),
    once_per_customer: bool(row.once_per_customer),
  };
}

function toAdmin(row: Row): AdminDiscount {
  return { ...toDiscountCode(row), created_at: iso(row.created_at), updated_at: iso(row.updated_at) };
}

function columns(input: DiscountInput) {
  return {
    code: input.code,
    title: input.title,
    type: input.type,
    value: input.type === "free_shipping" ? 0 : input.value,
    min_subtotal: input.min_subtotal,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    usage_limit: input.usage_limit,
    once_per_customer: input.once_per_customer,
    is_active: input.is_active,
    applies_to: input.applies_to.kind === "all" ? null : input.applies_to,
  };
}

function codeTaken(error: unknown): never {
  if (uniqueViolation(error)?.includes("code")) throw new BackendError("code_taken");
  throw error;
}

type Eb = ExpressionBuilder<Database, "discount_codes">;

// The same order of checks as discountStatus().
function statusFilter(eb: Eb, status: string, now: string) {
  const not_expired = eb.or([eb("ends_at", "is", null), eb("ends_at", ">=", now)]);
  const has_uses = eb.or([eb("usage_limit", "=", 0), eb("used_count", "<", eb.ref("usage_limit"))]);
  switch (status) {
    case "disabled":
      return eb("is_active", "=", false);
    case "expired":
      return eb.and([eb("is_active", "=", true), eb("ends_at", "<", now)]);
    case "used_up":
      return eb.and([
        eb("is_active", "=", true),
        not_expired,
        eb("usage_limit", ">", 0),
        eb("used_count", ">=", eb.ref("usage_limit")),
      ]);
    case "scheduled":
      return eb.and([eb("is_active", "=", true), not_expired, has_uses, eb("starts_at", ">", now)]);
    default:
      return eb.and([
        eb("is_active", "=", true),
        not_expired,
        has_uses,
        eb.or([eb("starts_at", "is", null), eb("starts_at", "<=", now)]),
      ]);
  }
}

export function createDiscounts(ctx: SqlContext): DiscountsBackend {
  const { db } = ctx;

  async function live(id: string): Promise<Row> {
    const row = await db.selectFrom("discount_codes").selectAll().where("id", "=", id).executeTakeFirst();
    if (!row || row.deleted_at) throw new BackendError("not_found");
    return row;
  }

  return {
    async list(filters, page_size, now) {
      let query = db.selectFrom("discount_codes").where("deleted_at", "is", null);
      if (filters.status !== "all") {
        const status = filters.status;
        query = query.where((eb) => statusFilter(eb, status, now));
      }
      if (filters.search) {
        const search = filters.search;
        query = query.where((eb) => eb.or([contains(ctx, "code", search), contains(ctx, "title", search)]));
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query.selectAll().orderBy("created_at", "desc").orderBy("id").offset(offset).limit(limit).execute()
          ).map(toAdmin),
      );
    },

    async get(id) {
      return toAdmin(await live(id));
    },

    async create(input) {
      const id = newId();
      await db
        .insertInto("discount_codes")
        .values({ id, ...columns(input), used_count: 0 })
        .execute()
        .catch(codeTaken);
      return { id };
    },

    async update(id, input) {
      await live(id);
      await db
        .updateTable("discount_codes")
        .set({ ...columns(input), updated_at: nowIso() })
        .where("id", "=", id)
        .execute()
        .catch(codeTaken);
    },

    async delete(id) {
      const row = await live(id);
      // The code is freed for a new discount: the deleted one keeps a renamed code
      // ("_DELETED_<id>", which no customer types).
      await db
        .updateTable("discount_codes")
        .set({
          deleted_at: nowIso(),
          is_active: false,
          code: `${row.code}_DELETED_${row.id}`.toUpperCase().slice(0, 80),
          updated_at: nowIso(),
        })
        .where("id", "=", id)
        .execute();
    },

    async targets(applies_to) {
      if (applies_to.kind === "all" || applies_to.ids.length === 0) return [];
      const table = applies_to.kind === "products" ? "products" : "categories";
      const rows =
        table === "products"
          ? await db.selectFrom("products").select(["id", "title as name"]).where("id", "in", applies_to.ids).execute()
          : await db.selectFrom("categories").select(["id", "name"]).where("id", "in", applies_to.ids).execute();
      return rows.map((row) => ({ id: row.id, name: json<LocalizedText>(row.name, {}) }));
    },

    async productIdsInCategories(category_ids) {
      if (category_ids.length === 0) return [];
      const rows = await db
        .selectFrom("products")
        .select("id")
        .where("category_id", "in", category_ids)
        .where("deleted_at", "is", null)
        .execute();
      return rows.map((row) => row.id);
    },

    async usesByEmail(discount_id, email) {
      return toCount(
        await db
          .selectFrom("orders")
          .select((eb) => eb.fn.countAll().as("count"))
          .where("discount_code_id", "=", discount_id)
          .where((eb) => eb(eb.fn("lower", ["email"]), "=", email.toLowerCase()))
          .where("status", "!=", "cancelled")
          .where("deleted_at", "is", null)
          .executeTakeFirst(),
      );
    },
  };
}
