import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductsTable } from "./components/products-table";
import { getAdminCategories } from "@repo/core/actions/categories";
import { getAdminProducts } from "@repo/core/actions/products";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { product_list_filters_schema } from "@repo/core/lib/schemas/catalog";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.catalog.products.meta_title);
}

export default async function DashboardProductsPage({ searchParams }: PageProps<"/products">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("products.view");
  // Filters live in the URL, so a filtered list can be shared or reloaded.
  const filters = product_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, currency] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("CURRENCY"),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_products(filters),
      queryFn: async () => unwrap(await getAdminProducts(filters)),
    }),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_categories,
      queryFn: async () => unwrap(await getAdminCategories()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ProductsTable
          lang={lang}
          currency={currency}
          can_edit={callerShows(caller, "products.edit")}
          dictionary={dictionary.catalog}
          index_table={dictionary.admin_ui.index_table}
          confirm={dictionary.admin_ui.confirm}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
