import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { DomainsScreen } from "./components/domains-screen";
import { getDomains } from "@repo/core/actions/domains";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.domains.meta_title);
}

export default async function DomainsPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, result] = await Promise.all([getAdminDictionary(lang), getDomains()]);
  const query_client = new QueryClient();
  if (result.ok) query_client.setQueryData(query_keys.domains, result.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <DomainsScreen
        lang={lang}
        can_edit={callerShows(caller, "settings.edit")}
        dictionary={dictionary.domains}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
