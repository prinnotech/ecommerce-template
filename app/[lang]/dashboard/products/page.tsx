import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductsTable } from "./components/products-table";
import { getAdminCategories } from "@/app/actions/categories";
import { getAdminProducts } from "@/app/actions/products";
import { Skeleton } from "@/components/ui/skeleton";
import { unwrap } from "@/lib/action-result";
import { callerCan, requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";
import { product_list_filters_schema } from "@/lib/schemas/catalog";
import { getSiteSetting } from "@/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/products">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/products",
    title: dictionary.catalog.products.meta_title,
    is_private: true,
  });
}

export default async function DashboardProductsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/products">) {
  const { lang } = await params;
  const caller = await requirePermission(lang, "products.view");
  // Filters live in the URL, so a filtered list can be shared or reloaded.
  const filters = product_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, currency] = await Promise.all([
    getDictionary(lang),
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
          can_edit={callerCan(caller, "products.edit")}
          dictionary={dictionary.catalog}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
