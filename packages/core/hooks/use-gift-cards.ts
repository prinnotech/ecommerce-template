"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getGiftCard, getGiftCards, issueGiftCardByStaff, setGiftCardActive } from "@repo/core/actions/gift-cards";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { GiftCardFilters, IssueGiftCardInput } from "@repo/core/lib/schemas/gift-cards";

export function useGiftCards(filters: GiftCardFilters) {
  return useQuery({
    queryKey: query_keys.gift_cards(filters),
    queryFn: async () => unwrap(await getGiftCards(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useGiftCard(id: string | null) {
  return useQuery({
    queryKey: query_keys.gift_card(id ?? ""),
    queryFn: async () => unwrap(await getGiftCard(id ?? "")),
    enabled: Boolean(id),
  });
}

export function useIssueGiftCard() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssueGiftCardInput) => unwrap(await issueGiftCardByStaff(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.gift_cards_all }),
  });
}

export function useSetGiftCardActive() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => unwrap(await setGiftCardActive(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.gift_cards_all }),
  });
}
