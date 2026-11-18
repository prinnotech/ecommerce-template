import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { AiScreen } from "./components/ai-screen";
import { getAiSettings } from "@repo/core/actions/languages";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.ai_settings.title);
}

export default async function AiSettingsPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, overview] = await Promise.all([getAdminDictionary(lang), getAiSettings()]);
  const query_client = new QueryClient();
  if (overview.ok) query_client.setQueryData(query_keys.ai_settings, overview.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <AiScreen
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        dictionary={dictionary.ai_settings}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
