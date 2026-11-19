"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBlogPost, deleteBlogPost, getBlogPosts, updateBlogPost } from "@repo/core/actions/blog";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { BlogListFilters, BlogPostInput } from "@repo/core/lib/schemas/blog";

export function useBlogPosts(filters: BlogListFilters) {
  return useQuery({
    queryKey: query_keys.blog_posts(filters),
    queryFn: async () => unwrap(await getBlogPosts(filters)),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateBlog() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.blog_posts_all });
}

export function useCreateBlogPost() {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: async (post: BlogPostInput) => unwrap(await createBlogPost(post)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateBlogPost(id: string) {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: async (post: BlogPostInput) => unwrap(await updateBlogPost({ id, post })),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteBlogPost() {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteBlogPost(id)),
    onSuccess: () => invalidate(),
  });
}
