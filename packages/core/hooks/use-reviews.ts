"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteReview,
  getMyReviewState,
  getProductReviews,
  getReviews,
  replyToReview,
  setReviewStatus,
  submitReview,
  type ProductReviews,
} from "@repo/core/actions/reviews";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { ReviewFilters, ReviewInput, ReviewStatus } from "@repo/core/lib/schemas/reviews";

// ---------- Store ----------

// Approved reviews, page by page; the first page comes from the server render.
export function useProductReviews(product_id: string, first_page: ProductReviews) {
  return useInfiniteQuery({
    queryKey: query_keys.product_reviews(product_id),
    queryFn: async ({ pageParam }) => unwrap(await getProductReviews({ product_id, page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.reviews.page < last.reviews.total_pages ? last.reviews.page + 1 : undefined),
    initialData: { pages: [first_page], pageParams: [1] },
    staleTime: 60_000,
  });
}

export function useMyReviewState(product_id: string) {
  return useQuery({
    queryKey: query_keys.my_review(product_id),
    queryFn: async () => unwrap(await getMyReviewState({ product_id })),
  });
}

export function useSubmitReview() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewInput & { locale: string }) => unwrap(await submitReview(input)),
    onSuccess: (_data, input) => query_client.invalidateQueries({ queryKey: query_keys.my_review(input.product_id) }),
  });
}

// ---------- Admin ----------

export function useReviews(filters: ReviewFilters) {
  return useQuery({
    queryKey: query_keys.reviews(filters),
    queryFn: async () => unwrap(await getReviews(filters)),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateReviews() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.reviews_all });
}

export function useSetReviewStatus() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { id: string; status: ReviewStatus }) => unwrap(await setReviewStatus(input)),
    onSuccess: invalidate,
  });
}

export function useReplyToReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { id: string; reply: string }) => unwrap(await replyToReview(input)),
    onSuccess: invalidate,
  });
}

export function useDeleteReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteReview(id)),
    onSuccess: invalidate,
  });
}
