"use client";

import { PlusIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@repo/admin-ui/components/empty-state";
import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { Campaign } from "@repo/core/actions/campaigns";
import { useCampaigns } from "@repo/core/hooks/use-campaigns";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  CAMPAIGN_STATUSES,
  campaign_list_filters_schema,
  type CampaignListFilters,
  type CampaignStatus,
} from "@repo/core/lib/schemas/campaigns";
import { formatDateTime, formatNumber, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";

export const CAMPAIGN_TONE: Record<CampaignStatus, StatusTone> = {
  draft: "neutral",
  sending: "info",
  sent: "success",
};

type CampaignsTableProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["campaigns"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function CampaignsTable({ lang, can_edit, dictionary, index_table, errors }: CampaignsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = campaign_list_filters_schema.parse(Object.fromEntries(search_params));
  const campaigns = useCampaigns(filters);

  function setFilters(patch: Partial<CampaignListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.status !== "all") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = [
    { key: "all", label: dictionary.all },
    ...CAMPAIGN_STATUSES.map((status) => ({ key: status, label: dictionary.status[status] })),
  ];

  const columns: IndexColumn<Campaign>[] = [
    { key: "name", header: dictionary.columns.name, is_primary: true, cell: (campaign) => campaign.name },
    {
      key: "status",
      header: dictionary.columns.status,
      cell: (campaign) => (
        <StatusBadge tone={CAMPAIGN_TONE[campaign.status]}>{dictionary.status[campaign.status]}</StatusBadge>
      ),
    },
    {
      key: "recipients",
      header: dictionary.columns.recipients,
      align: "end",
      min_width: "sm",
      cell: (campaign) => (campaign.status === "draft" ? "—" : formatNumber(campaign.recipient_count, lang)),
    },
    {
      key: "sent",
      header: dictionary.columns.sent,
      align: "end",
      min_width: "md",
      cell: (campaign) => (campaign.status === "draft" ? "—" : formatNumber(campaign.sent_count, lang)),
    },
    {
      key: "date",
      header: dictionary.columns.date,
      min_width: "lg",
      className: "text-muted-foreground",
      cell: (campaign) => formatDateTime(campaign.sent_at || campaign.updated_at, lang),
    },
  ];

  const create_action = can_edit ? (
    <Button asChild>
      <Link href="/campaigns/new">
        <PlusIcon />
        {dictionary.create}
      </Link>
    </Button>
  ) : undefined;

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full" primary_action={create_action}>
      <IndexTable
        lang={lang}
        rows={campaigns.data?.items ?? []}
        getRowId={(campaign) => campaign.id}
        getRowHref={(campaign) => `/campaigns/${campaign.id}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.status}
        onViewChange={(key) => {
          const status = key === "all" ? "all" : CAMPAIGN_STATUSES.find((item) => item === key);
          if (status) setFilters({ status });
        }}
        page={campaigns.data?.page ?? filters.page}
        total_pages={campaigns.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={campaigns.data ? formatPlural(campaigns.data.total_items, dictionary.results, lang) : undefined}
        is_loading={campaigns.isFetching}
        empty_state={
          <EmptyState
            icon={SendIcon}
            title={dictionary.empty_title}
            body={dictionary.empty_body}
            action={create_action}
          />
        }
        renderMobileRow={(campaign) => (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-medium">{campaign.name}</span>
            <StatusBadge tone={CAMPAIGN_TONE[campaign.status]}>{dictionary.status[campaign.status]}</StatusBadge>
          </div>
        )}
        dictionary={index_table}
      />
      {campaigns.isError && <p className="text-destructive text-sm">{errorText(errors, campaigns.error)}</p>}
    </Page>
  );
}
