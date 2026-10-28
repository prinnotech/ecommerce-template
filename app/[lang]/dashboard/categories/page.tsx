import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { CategoryList } from "./components/category-list";
import { getAdminCategories } from "@/app/actions/categories";
import { unwrap } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/categories">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/categories",
    title: dictionary.catalog.categories.meta_title,
    is_private: true,
  });
}

export default async function DashboardCategoriesPage({ params }: PageProps<"/[lang]/dashboard/categories">) {
  const { lang } = await params;
  await requirePermission(lang, "categories.edit");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_categories,
      queryFn: async () => unwrap(await getAdminCategories()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <CategoryList
        lang={lang}
        dictionary={dictionary.catalog.categories}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
