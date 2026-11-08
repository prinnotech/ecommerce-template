import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalyticsScreen } from "./components/analytics-screen";
import { getAnalytics } from "@repo/core/actions/analytics";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { analytics_filters_schema } from "@repo/core/lib/analytics";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.analytics.title);
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const lang = await getAdminLocale();
  await requirePermission("analytics.view");
  const filters = analytics_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, analytics] = await Promise.all([getAdminDictionary(lang), getAnalytics(filters)]);
  if (analytics.ok) query_client.setQueryData(query_keys.analytics(filters), analytics.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AnalyticsScreen lang={lang} dictionary={dictionary.analytics} errors={dictionary.errors} />
      </Suspense>
    </HydrationBoundary>
  );
}
