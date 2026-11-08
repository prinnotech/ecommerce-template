import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomersTable } from "./components/customers-table";
import { IndexTableSkeleton } from "@repo/admin-ui/components/skeletons";
import { getCustomers } from "@repo/core/actions/customers";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { customer_list_filters_schema } from "@repo/core/lib/schemas/customers";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.customers.meta_title);
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const lang = await getAdminLocale();
  await requirePermission("customers.view");
  const filters = customer_list_filters_schema.parse(await searchParams);
  const [dictionary, currency, result] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("CURRENCY"),
    getCustomers(filters),
  ]);
  // The first page is rendered on the server; the table refetches as filters change.
  const query_client = new QueryClient();
  if (result.ok) query_client.setQueryData(query_keys.admin_customers(filters), result.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<IndexTableSkeleton />}>
        <CustomersTable
          lang={lang}
          currency={currency}
          dictionary={dictionary.customers}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
