import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { DraftsTable } from "./components/drafts-table";
import { getDraftOrders } from "@repo/core/actions/draft-orders";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { draft_list_filters_schema } from "@repo/core/lib/schemas/draft-orders";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.draft_orders.title);
}

export default async function DraftOrdersPage({ searchParams }: PageProps<"/orders/drafts">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("draft_orders.view");
  const filters = draft_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, drafts] = await Promise.all([getAdminDictionary(lang), getDraftOrders(filters)]);
  if (drafts.ok) query_client.setQueryData(query_keys.draft_orders(filters), drafts.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DraftsTable
          lang={lang}
          can_edit={callerShows(caller, "draft_orders.edit")}
          dictionary={dictionary.draft_orders}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
