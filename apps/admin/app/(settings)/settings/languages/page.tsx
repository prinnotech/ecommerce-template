import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { LanguagesScreen } from "./components/languages-screen";
import { getLanguages } from "@repo/core/actions/languages";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.languages.title);
}

export default async function LanguagesPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, overview] = await Promise.all([getAdminDictionary(lang), getLanguages()]);
  const query_client = new QueryClient();
  if (overview.ok) query_client.setQueryData(query_keys.languages, overview.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <LanguagesScreen
        lang={lang}
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        dictionary={dictionary.languages}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
