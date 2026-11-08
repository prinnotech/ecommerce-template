import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { ThemesScreen } from "./components/themes-screen";
import { getThemes } from "@repo/core/actions/themes";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.themes.meta_title);
}

export default async function ThemesPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("themes.view");
  const [dictionary, result] = await Promise.all([getAdminDictionary(lang), getThemes()]);
  const query_client = new QueryClient();
  if (result.ok) query_client.setQueryData(query_keys.themes, result.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <ThemesScreen
        lang={lang}
        can_edit={callerShows(caller, "themes.edit")}
        dictionary={dictionary.themes}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
