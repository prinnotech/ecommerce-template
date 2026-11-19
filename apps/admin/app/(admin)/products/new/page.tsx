import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { ProductEditor } from "../components/product-editor";
import { getAdminCategories } from "@repo/core/actions/categories";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.catalog.editor.new_title);
}

export default async function NewProductPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("products.edit");
  const query_client = new QueryClient();
  const [dictionary, currency] = await Promise.all([
    getAdminDictionary(lang),
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
        images_dictionary={dictionary.admin_ui.images}
        files_picker={dictionary.files.picker}
        custom_data={dictionary.custom_data}
        can_manage_fields={callerShows(caller, "settings.view")}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
        seo={dictionary.admin_ui.seo}
      />
    </HydrationBoundary>
  );
}
