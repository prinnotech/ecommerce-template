import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CampaignsTable } from "./components/campaigns-table";
import { getCampaigns } from "@repo/core/actions/campaigns";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { campaign_list_filters_schema } from "@repo/core/lib/schemas/campaigns";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.campaigns.title);
}

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("campaigns.view");
  const filters = campaign_list_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, campaigns] = await Promise.all([getAdminDictionary(lang), getCampaigns(filters)]);
  if (campaigns.ok) query_client.setQueryData(query_keys.campaigns(filters), campaigns.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CampaignsTable
          lang={lang}
          can_edit={callerShows(caller, "campaigns.edit")}
          dictionary={dictionary.campaigns}
          index_table={dictionary.admin_ui.index_table}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
