import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { OrdersTable } from "./components/orders-table";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { readAdminOrders } from "@repo/core/lib/orders-read";
import { query_keys } from "@repo/core/lib/query-keys";
import { order_list_filters_schema } from "@repo/core/lib/schemas/orders";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.orders_admin.meta_title);
}

export default async function DashboardOrdersPage({ searchParams }: PageProps<"/orders">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("orders.view");
  const filters = order_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  // Fetch directly through a server-only reader: "use server" functions only run for
  // mutations in this Next.js version, so prefetchQuery would silently skip the data.
  const [dictionary, orders_result] = await Promise.all([getAdminDictionary(lang), readAdminOrders(filters)]);
  if (orders_result.ok) {
    query_client.setQueryData(query_keys.admin_orders(filters), orders_result.data);
  }

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrdersTable
          lang={lang}
          can_edit={callerShows(caller, "orders.edit")}
          dictionary={dictionary.orders_admin}
          order_status={dictionary.order_status}
          payment_status={dictionary.payment_status}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
