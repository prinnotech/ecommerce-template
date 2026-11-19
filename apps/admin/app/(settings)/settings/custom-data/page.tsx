import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { CustomDataScreen } from "./components/custom-data-screen";
import { getMetafieldDefinitions } from "@repo/core/actions/metafields";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.custom_data.title);
}

export default async function CustomDataPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, definitions] = await Promise.all([getAdminDictionary(lang), getMetafieldDefinitions()]);
  const query_client = new QueryClient();
  if (definitions.ok) query_client.setQueryData(query_keys.metafield_definitions, definitions.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <CustomDataScreen
        lang={lang}
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        dictionary={dictionary.custom_data}
        confirm={dictionary.admin_ui.confirm}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
