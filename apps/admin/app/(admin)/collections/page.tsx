import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { CollectionsTable } from "./components/collections-table";
import { getCollections } from "@repo/core/actions/collections";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.collections.title);
}

export default async function CollectionsPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("collections.view");
  const query_client = new QueryClient();
  const [dictionary, collections] = await Promise.all([getAdminDictionary(lang), getCollections()]);
  if (collections.ok) query_client.setQueryData(query_keys.collections, collections.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <CollectionsTable
        lang={lang}
        can_edit={callerShows(caller, "collections.edit")}
        dictionary={dictionary.collections}
        index_table={dictionary.admin_ui.index_table}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
