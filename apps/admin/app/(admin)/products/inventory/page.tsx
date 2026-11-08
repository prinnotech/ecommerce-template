import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { InventoryTable } from "./components/inventory-table";
import { getAdminCategories } from "@repo/core/actions/categories";
import { getInventory } from "@repo/core/actions/inventory";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { inventory_filters_schema } from "@repo/core/lib/schemas/inventory";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.inventory.title);
}

export default async function InventoryPage({ searchParams }: PageProps<"/products/inventory">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("inventory.view");
  const filters = inventory_filters_schema.parse(await searchParams);
  // Categories (for the filter) are read under products.view.
  const can_filter_category = callerShows(caller, "products.view");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.inventory(filters),
      queryFn: async () => unwrap(await getInventory(filters)),
    }),
    can_filter_category
      ? query_client.prefetchQuery({
          queryKey: query_keys.admin_categories,
          queryFn: async () => unwrap(await getAdminCategories()),
        })
      : null,
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <InventoryTable
          lang={lang}
          can_edit={callerShows(caller, "inventory.edit")}
          can_filter_category={can_filter_category}
          dictionary={dictionary.inventory}
          catalog={dictionary.catalog}
          index_table={dictionary.admin_ui.index_table}
          common={dictionary.common}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
