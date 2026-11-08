import "server-only";

import type { Selectable } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { Review, ReviewsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { ReviewStatus } from "@repo/core/lib/schemas/reviews";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import type { ReviewsTable } from "@repo/backend-sql/schema";
import { iso, json, newId, nowIso } from "@repo/backend-sql/values";

function toReview(row: Selectable<ReviewsTable>): Review {
  return {
    id: row.id,
    product_id: row.product_id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    author_name: row.author_name,
    status: row.status as ReviewStatus,
    reply: row.reply,
    created_at: iso(row.created_at),
  };
}

export function createReviews(ctx: SqlContext): ReviewsBackend {
  const { db } = ctx;

  async function exists(id: string) {
    const row = await db.selectFrom("reviews").select("id").where("id", "=", id).executeTakeFirst();
    if (!row) throw new BackendError("not_found");
  }

  return {
    async list(filters, page_size) {
      let query = db.selectFrom("reviews").innerJoin("products", "products.id", "reviews.product_id");
      if (filters.status !== "all") query = query.where("reviews.status", "=", filters.status);
      if (filters.search) {
        const search = filters.search;
        query = query.where((eb) =>
          eb.or([
            contains(ctx, "reviews.body", search),
            contains(ctx, "reviews.title", search),
            contains(ctx, "reviews.email", search),
            contains(ctx, "products.title", search),
          ]),
        );
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query
              .selectAll("reviews")
              .select("products.title as product_title")
              .orderBy("reviews.created_at", "desc")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map((row) => ({
            ...toReview(row),
            email: row.email,
            product_title: json<LocalizedText>(row.product_title, {}),
          })),
      );
    },

    async approved(product_id, page, page_size) {
      const query = db.selectFrom("reviews").where("product_id", "=", product_id).where("status", "=", "approved");
      return paginate(
        page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (await query.selectAll().orderBy("created_at", "desc").offset(offset).limit(limit).execute()).map(toReview),
      );
    },

    async summary(product_id) {
      const row = await db
        .selectFrom("reviews")
        .select([(eb) => eb.fn.avg("rating").as("average"), (eb) => eb.fn.countAll().as("count")])
        .where("product_id", "=", product_id)
        .where("status", "=", "approved")
        .executeTakeFirst();
      const count = Number(row?.count ?? 0);
      return { average: count > 0 ? Number(row?.average ?? 0) : 0, count };
    },

    async mine(user_id, product_id) {
      const row = await db
        .selectFrom("reviews")
        .selectAll()
        .where("user_id", "=", user_id)
        .where("product_id", "=", product_id)
        .executeTakeFirst();
      return row ? toReview(row) : null;
    },

    async hasPurchased(user_id, product_id) {
      const row = await db
        .selectFrom("order_items")
        .innerJoin("orders", "orders.id", "order_items.order_id")
        .select("order_items.id")
        .where("orders.user_id", "=", user_id)
        .where("order_items.product_id", "=", product_id)
        .where("orders.status", "not in", ["cancelled"])
        .where("orders.deleted_at", "is", null)
        .executeTakeFirst();
      return Boolean(row);
    },

    async create(review) {
      const id = newId();
      await db
        .insertInto("reviews")
        .values({
          id,
          product_id: review.product_id,
          user_id: review.user_id,
          email: review.email,
          rating: review.rating,
          title: review.title,
          body: review.body,
          author_name: review.author_name,
          locale: review.locale,
          status: "pending",
          reply: "",
        })
        .execute()
        .catch((error: unknown) => {
          if (uniqueViolation(error)) throw new BackendError("review_exists");
          throw error;
        });
      return { id };
    },

    async setStatus(id, status) {
      await exists(id);
      await db.updateTable("reviews").set({ status, updated_at: nowIso() }).where("id", "=", id).execute();
    },

    async reply(id, reply) {
      await exists(id);
      await db.updateTable("reviews").set({ reply, updated_at: nowIso() }).where("id", "=", id).execute();
    },

    async delete(id) {
      await exists(id);
      await db.deleteFrom("reviews").where("id", "=", id).execute();
    },
  };
}
