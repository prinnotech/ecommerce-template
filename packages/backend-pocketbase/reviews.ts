import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { Review, ReviewsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import type { ReviewFilters, ReviewStatus } from "@repo/core/lib/schemas/reviews";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { ReviewsResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

function toReview(record: ReviewsResponse): Review {
  return {
    id: record.id,
    product_id: record.product,
    rating: record.rating,
    title: record.title,
    body: record.body,
    author_name: record.author_name,
    status: record.status as ReviewStatus,
    reply: record.reply,
    created_at: record.created_at,
  };
}

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

function buildFilter(pb: TypedPocketBase, filters: ReviewFilters): string {
  const parts: string[] = [];
  if (filters.status !== "all") parts.push(pb.filter("status = {:status}", { status: filters.status }));
  if (filters.search) {
    parts.push(
      pb.filter("(body ~ {:search} || title ~ {:search} || email ~ {:search} || product.title ~ {:search})", {
        search: filters.search,
      }),
    );
  }
  return parts.join(" && ");
}

export const reviews: ReviewsBackend = {
  async list(filters, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("reviews").getList(filters.page, page_size, {
      filter: buildFilter(pb, filters),
      sort: "-created_at",
      expand: "product",
    });
    type WithProduct = (typeof result.items)[number] & { expand?: { product?: { title?: LocalizedText | null } } };
    return {
      items: (result.items as WithProduct[]).map((record) => ({
        ...toReview(record),
        email: record.email,
        product_title: record.expand?.product?.title ?? {},
      })),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async approved(product_id, page, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("reviews").getList(page, page_size, {
      filter: pb.filter('product = {:product} && status = "approved"', { product: product_id }),
      sort: "-created_at",
    });
    return {
      items: result.items.map(toReview),
      page: result.page,
      total_pages: Math.max(1, result.totalPages),
      total_items: result.totalItems,
    };
  },

  async summary(product_id) {
    const pb = await createAdminPocketBase();
    const ratings = await pb.collection("reviews").getFullList({
      filter: pb.filter('product = {:product} && status = "approved"', { product: product_id }),
      fields: "rating",
    });
    const count = ratings.length;
    return { average: count > 0 ? ratings.reduce((sum, item) => sum + item.rating, 0) / count : 0, count };
  },

  async mine(user_id, product_id) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("reviews").getList(1, 1, {
      filter: pb.filter("user = {:user} && product = {:product}", { user: user_id, product: product_id }),
      skipTotal: true,
    });
    return result.items[0] ? toReview(result.items[0]) : null;
  },

  async hasPurchased(user_id, product_id) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("order_items").getList(1, 1, {
      filter: pb.filter(
        'product = {:product} && order.user = {:user} && order.status != "cancelled" && order.deleted_at = ""',
        {
          product: product_id,
          user: user_id,
        },
      ),
      fields: "id",
      skipTotal: true,
    });
    return result.items.length > 0;
  },

  async create(review) {
    const pb = await createAdminPocketBase();
    if (await reviews.mine(review.user_id, review.product_id)) throw new BackendError("review_exists");
    const record = await pb.collection("reviews").create({
      product: review.product_id,
      user: review.user_id,
      email: review.email,
      rating: review.rating,
      title: review.title,
      body: review.body,
      author_name: review.author_name,
      locale: review.locale,
      status: "pending",
      reply: "",
    });
    return { id: record.id };
  },

  async setStatus(id, status) {
    const pb = await createAdminPocketBase();
    await pb.collection("reviews").update(id, { status }).catch(notFound);
  },

  async reply(id, reply) {
    const pb = await createAdminPocketBase();
    await pb.collection("reviews").update(id, { reply }).catch(notFound);
  },

  async delete(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("reviews").delete(id).catch(notFound);
  },
};
