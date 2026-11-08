import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ActivityLog } from "./components/activity-log";
import { getActivityLog } from "@repo/core/actions/activity";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { activity_filters_schema } from "@repo/core/lib/schemas/admin";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.activity.meta_title);
}

export default async function ActivityPage({ searchParams }: PageProps<"/settings/activity">) {
  const lang = await getAdminLocale();
  await requirePermission("audit.view");
  const filters = activity_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.activity(filters),
      queryFn: async () => unwrap(await getActivityLog(filters)),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ActivityLog
          lang={lang}
          dictionary={dictionary.activity}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
