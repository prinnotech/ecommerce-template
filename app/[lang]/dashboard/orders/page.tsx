import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { OrdersTable } from "./components/orders-table";
import { getAdminOrders } from "@/app/actions/orders";
import { Skeleton } from "@/components/ui/skeleton";
import { unwrap } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";
import { order_list_filters_schema } from "@/lib/schemas/orders";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/orders">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/orders",
    title: dictionary.orders_admin.meta_title,
    is_private: true,
  });
}

export default async function DashboardOrdersPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  const { lang } = await params;
  await requirePermission(lang, "orders.view");
  const filters = order_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_orders(filters),
      queryFn: async () => unwrap(await getAdminOrders(filters)),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrdersTable
          lang={lang}
          dictionary={dictionary.orders_admin}
          order_status={dictionary.order_status}
          payment_status={dictionary.payment_status}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
