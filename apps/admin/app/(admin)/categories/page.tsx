import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { CategoryList } from "./components/category-list";
import { getAdminCategories } from "@repo/core/actions/categories";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.catalog.categories.meta_title);
}

export default async function DashboardCategoriesPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("categories.view");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_categories,
      queryFn: async () => unwrap(await getAdminCategories()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <CategoryList
        lang={lang}
        can_edit={callerShows(caller, "categories.edit")}
        dictionary={dictionary.catalog.categories}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
        seo={dictionary.admin_ui.seo}
      />
    </HydrationBoundary>
  );
}
