import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AbandonedTable } from "./components/abandoned-table";
import { getAbandonedCheckouts } from "@repo/core/actions/abandoned-checkouts";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { abandoned_checkout_filters_schema } from "@repo/core/lib/schemas/abandoned-checkouts";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.abandoned.title);
}

export default async function AbandonedCheckoutsPage({ searchParams }: PageProps<"/orders/abandoned">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("orders.view");
  const filters = abandoned_checkout_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, page] = await Promise.all([getAdminDictionary(lang), getAbandonedCheckouts(filters)]);
  if (page.ok) query_client.setQueryData(query_keys.abandoned_checkouts(filters), page.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AbandonedTable
          lang={lang}
          can_edit={callerShows(caller, "orders.edit")}
          dictionary={dictionary.abandoned}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
