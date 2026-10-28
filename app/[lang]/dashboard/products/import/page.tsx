import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { ImportWizard } from "./components/import-wizard";
import { getAdminCategories } from "@/app/actions/categories";
import { unwrap } from "@/lib/action-result";
import { callerCan, requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/products/import">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/products/import",
    title: dictionary.catalog.import.meta_title,
    is_private: true,
  });
}

export default async function ImportPage({ params, searchParams }: PageProps<"/[lang]/dashboard/products/import">) {
  const { lang } = await params;
  const caller = await requirePermission(lang, "products.edit");
  const { type } = await searchParams;
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_categories,
      queryFn: async () => unwrap(await getAdminCategories()),
    }),
  ]);
  const can_edit_categories = callerCan(caller, "categories.edit");

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
