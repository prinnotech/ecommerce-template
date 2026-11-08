import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { TrackingScreen } from "./components/tracking-screen";
import { getTracking } from "@repo/core/actions/tracking";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.tracking.title);
}

export default async function TrackingPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, overview] = await Promise.all([getAdminDictionary(lang), getTracking()]);
  const query_client = new QueryClient();
  if (overview.ok) query_client.setQueryData(query_keys.tracking, overview.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <TrackingScreen
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        dictionary={dictionary.tracking}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
