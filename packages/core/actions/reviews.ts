"use server";

import { revalidatePath } from "next/cache";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminReview, Page, Review, ReviewSummary } from "@repo/core/backend/types";
import { isLocale } from "@repo/core/i18nConfig";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, getCurrentUser } from "@repo/core/lib/auth";
import { getClientIp, isRateLimited } from "@repo/core/lib/rate-limit";
import { id_schema } from "@repo/core/lib/schemas/ids";
import {
  REVIEW_STATUSES,
  review_filters_schema,
  review_input_schema,
  review_reply_schema,
  type ReviewFilters,
  type ReviewInput,
  type ReviewStatus,
} from "@repo/core/lib/schemas/reviews";

const STORE_PAGE_SIZE = 10;
const ADMIN_PAGE_SIZE = 25;

// ---------- Store ----------

export type ProductReviews = { summary: ReviewSummary; reviews: Page<Review> };

export async function getProductReviews(input: {
  product_id: string;
  page?: number;
}): Promise<ActionResult<ProductReviews>> {
  if (!id_schema.safeParse(input.product_id).success) return fail("not_found");
  try {
    const backend = getBackend().reviews;
    const [summary, reviews] = await Promise.all([
      backend.summary(input.product_id),
      backend.approved(input.product_id, Math.max(1, Math.floor(input.page ?? 1)), STORE_PAGE_SIZE),
    ]);
    return ok({ summary, reviews });
  } catch (error) {
    return failFrom(error, "reviews", "getProductReviews");
  }
}

// What the review form shows: sign in, "only buyers", the customer's own review, or the form.
export type MyReviewState =
  | { kind: "signed_out" }
  | { kind: "not_bought" }
  | { kind: "reviewed"; review: Review }
  | { kind: "can_review"; author_name: string };

export async function getMyReviewState(input: { product_id: string }): Promise<ActionResult<MyReviewState>> {
  if (!id_schema.safeParse(input.product_id).success) return fail("not_found");
  const user = await getCurrentUser();
  if (!user) return ok({ kind: "signed_out" });
  try {
    const backend = getBackend().reviews;
    const mine = await backend.mine(user.id, input.product_id);
    if (mine) return ok({ kind: "reviewed", review: mine });
    if (!(await backend.hasPurchased(user.id, input.product_id))) return ok({ kind: "not_bought" });
    return ok({ kind: "can_review", author_name: user.name.split(" ")[0] ?? "" });
  } catch (error) {
    return failFrom(error, "reviews", "getMyReviewState");
  }
}

export async function submitReview(input: ReviewInput & { locale: string }): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  const parsed = review_input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const ip = await getClientIp();
  if (isRateLimited(`review:${ip}`, 10, 60 * 60_000)) return fail("rate_limited");
  try {
    const backend = getBackend().reviews;
    if (!(await backend.hasPurchased(user.id, parsed.data.product_id))) return fail("review_not_allowed");
    await backend.create({
      ...parsed.data,
      user_id: user.id,
      email: user.email,
      locale: isLocale(input.locale) ? input.locale : "",
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "reviews", "submitReview");
  }
}

// ---------- Admin ----------

export async function getReviews(input: Partial<ReviewFilters>): Promise<ActionResult<Page<AdminReview>>> {
  const auth = await authorize("reviews.view", "view reviews");
  if (!auth.ok) return auth;
  const filters = review_filters_schema.parse(input);
  try {
    return ok(await getBackend().reviews.list(filters, ADMIN_PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "reviews", "getReviews");
  }
}

// Approved and hidden reviews change product pages, so the store is refreshed.
function revalidateStore() {
  revalidatePath("/", "layout");
}

export async function setReviewStatus(input: { id: string; status: ReviewStatus }): Promise<ActionResult<null>> {
  const auth = await authorize("reviews.edit", "moderate a review");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success || !REVIEW_STATUSES.includes(input.status)) return fail("invalid_input");
  try {
    await getBackend().reviews.setStatus(input.id, input.status);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "moderate a review",
      target_type: "review",
      target_id: input.id,
      details: { status: input.status },
    });
    revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "reviews", "setReviewStatus");
  }
}

export async function replyToReview(input: { id: string; reply: string }): Promise<ActionResult<null>> {
  const auth = await authorize("reviews.edit", "reply to a review");
  if (!auth.ok) return auth;
  const parsed = review_reply_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    await getBackend().reviews.reply(parsed.data.id, parsed.data.reply);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "reply to a review",
      target_type: "review",
      target_id: parsed.data.id,
    });
    revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "reviews", "replyToReview");
  }
}

export async function deleteReview(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("reviews.edit", "delete a review");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().reviews.delete(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a review",
      target_type: "review",
      target_id: id,
    });
    revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "reviews", "deleteReview");
  }
}
