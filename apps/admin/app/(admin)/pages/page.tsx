import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PagesScreen } from "./components/pages-screen";
import { getPages } from "@repo/core/actions/pages";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { SITE_URL } from "@repo/core/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.custom_pages.meta_title);
}

export default async function PagesPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("pages.view");
  const [dictionary, result] = await Promise.all([getAdminDictionary(lang), getPages()]);
  const query_client = new QueryClient();
  if (result.ok) query_client.setQueryData(query_keys.pages, result.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <PagesScreen
        lang={lang}
        store_url={SITE_URL}
        can_edit={callerShows(caller, "pages.edit")}
        can_customize={callerShows(caller, "themes.view")}
        dictionary={dictionary.custom_pages}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
