import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductEditor } from "../components/product-editor";
import { getAdminCategories } from "@/app/actions/categories";
import { getAdminProduct } from "@/app/actions/products";
import { unwrap } from "@/lib/action-result";
import { callerCan, requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";
import { getSiteSetting } from "@/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/products/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: `/dashboard/products/${id}`,
    title: dictionary.catalog.products.meta_title,
    is_private: true,
  });
}

export default async function EditProductPage({ params }: PageProps<"/[lang]/dashboard/products/[id]">) {
  const { lang, id } = await params;
  const caller = await requirePermission(lang, "products.view");
  const product = await getAdminProduct(id);
  if (!product.ok) notFound();

  const query_client = new QueryClient();
  query_client.setQueryData(query_keys.admin_product(id), product.data);
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
        product_id={id}
        can_edit={callerCan(caller, "products.edit")}
        currency={currency}
        dictionary={dictionary.catalog}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
