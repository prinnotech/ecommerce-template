"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  countCampaignRecipients,
  deleteCampaign,
  getCampaign,
  getCampaigns,
  saveCampaign,
  sendCampaign,
  sendCampaignTest,
} from "@repo/core/actions/campaigns";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { CampaignInput, CampaignListFilters } from "@repo/core/lib/schemas/campaigns";

export function useCampaigns(filters: CampaignListFilters) {
  return useQuery({
    queryKey: query_keys.campaigns(filters),
    queryFn: async () => unwrap(await getCampaigns(filters)),
    placeholderData: keepPreviousData,
  });
}

// While a campaign is going out, its numbers refresh every few seconds.
export function useCampaign(id: string) {
  return useQuery({
    queryKey: query_keys.campaign(id),
    queryFn: async () => unwrap(await getCampaign(id)),
    refetchInterval: (query) => (query.state.data?.status === "sending" ? 5000 : false),
  });
}

export function useCampaignRecipients(segment_id: string) {
  return useQuery({
    queryKey: query_keys.campaign_recipients(segment_id),
    queryFn: async () => unwrap(await countCampaignRecipients(segment_id)),
  });
}

function useInvalidateCampaigns() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.campaigns_all });
}

export function useSaveCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async (input: { id: string | null; campaign: CampaignInput }) => unwrap(await saveCampaign(input)),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCampaign(id)),
    onSuccess: () => invalidate(),
  });
}

export function useSendCampaignTest() {
  return useMutation({
    mutationFn: async (input: { id: string; locale: string }) => unwrap(await sendCampaignTest(input)),
  });
}

export function useSendCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await sendCampaign(id)),
    onSuccess: () => invalidate(),
  });
}
