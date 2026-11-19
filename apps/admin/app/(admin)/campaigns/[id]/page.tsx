import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignEditor } from "../components/campaign-editor";
import { getCampaign } from "@repo/core/actions/campaigns";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { isSmtpConfigured } from "@repo/core/lib/email/transport";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.campaigns.title);
}

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("campaigns.view");
  const [dictionary, smtp, campaign] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("SMTP"),
    getCampaign(id),
  ]);
  if (!campaign.ok) notFound();
  const query_client = new QueryClient();
  query_client.setQueryData(query_keys.campaign(id), campaign.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <CampaignEditor
        lang={lang}
        can_edit={callerShows(caller, "campaigns.edit")}
        campaign_id={id}
        has_smtp={isSmtpConfigured(smtp)}
        dictionary={dictionary.campaigns}
        common={dictionary.common}
        confirm={dictionary.admin_ui.confirm}
        save_bar={dictionary.admin_ui.save_bar}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
