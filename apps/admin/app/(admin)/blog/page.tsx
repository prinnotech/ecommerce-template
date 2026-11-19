import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BlogTable } from "./components/blog-table";
import { getBlogPosts } from "@repo/core/actions/blog";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { blog_list_filters_schema } from "@repo/core/lib/schemas/blog";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.blog.title);
}

export default async function BlogPostsPage({ searchParams }: PageProps<"/blog">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("blog.view");
  const filters = blog_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, posts] = await Promise.all([getAdminDictionary(lang), getBlogPosts(filters)]);
  if (posts.ok) query_client.setQueryData(query_keys.blog_posts(filters), posts.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BlogTable
          lang={lang}
          can_edit={callerShows(caller, "blog.edit")}
          dictionary={dictionary.blog}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
