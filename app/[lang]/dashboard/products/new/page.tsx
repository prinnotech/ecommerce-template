import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { ProductEditor } from "../components/product-editor";
import { getAdminCategories } from "@/app/actions/categories";
import { unwrap } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";
import { getSiteSetting } from "@/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/products/new">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/products/new",
    title: dictionary.catalog.editor.new_title,
    is_private: true,
  });
}

export default async function NewProductPage({ params }: PageProps<"/[lang]/dashboard/products/new">) {
  const { lang } = await params;
  await requirePermission(lang, "products.edit");
  const query_client = new QueryClient();
  const [dictionary, currency] = await Promise.all([
    getDictionary(lang),
    getSiteSetting("CURRENCY"),
    query_client.prefetchQuery({
      queryKey: query_keys.admin_categories,
      queryFn: async () => unwrap(await getAdminCategories()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <ProductEditor
        lang={lang}
        product_id={null}
        can_edit
        currency={currency}
        dictionary={dictionary.catalog}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
