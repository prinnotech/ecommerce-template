import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscountsTable } from "./components/discounts-table";
import { getDiscounts } from "@repo/core/actions/discounts";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { discount_list_filters_schema } from "@repo/core/lib/schemas/discounts";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.discounts.title);
}

export default async function DiscountsPage({ searchParams }: PageProps<"/discounts">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("discounts.view");
  const filters = discount_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, currency, discounts] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("CURRENCY"),
    getDiscounts(filters),
  ]);
  if (discounts.ok) query_client.setQueryData(query_keys.discounts(filters), discounts.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DiscountsTable
          lang={lang}
          currency={currency}
          can_edit={callerShows(caller, "discounts.edit")}
          dictionary={dictionary.discounts}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
