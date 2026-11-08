import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewsScreen } from "./components/reviews-screen";
import { getReviews } from "@repo/core/actions/reviews";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { review_filters_schema } from "@repo/core/lib/schemas/reviews";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.reviews.title);
}

export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("reviews.view");
  const filters = review_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, reviews] = await Promise.all([getAdminDictionary(lang), getReviews(filters)]);
  if (reviews.ok) query_client.setQueryData(query_keys.reviews(filters), reviews.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReviewsScreen
          lang={lang}
          can_edit={callerShows(caller, "reviews.edit")}
          dictionary={dictionary.reviews}
          index_table={dictionary.admin_ui.index_table}
          common={dictionary.common}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
