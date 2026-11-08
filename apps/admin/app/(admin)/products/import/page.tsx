import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { ImportWizard } from "./components/import-wizard";
import { getAdminCategories } from "@repo/core/actions/categories";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.catalog.import.meta_title);
}

export default async function ImportPage({ searchParams }: PageProps<"/products/import">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("products.edit");
  const { type } = await searchParams;
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_categories,
      queryFn: async () => unwrap(await getAdminCategories()),
    }),
  ]);
  const can_edit_categories = callerShows(caller, "categories.edit");

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <ImportWizard
        lang={lang}
        initial_kind={type === "categories" && can_edit_categories ? "categories" : "products"}
        can_edit_categories={can_edit_categories}
        dictionary={dictionary.catalog.import}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
