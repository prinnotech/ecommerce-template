"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAbandonedCheckouts, sendAbandonedCheckoutEmail } from "@repo/core/actions/abandoned-checkouts";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { AbandonedCheckoutFilters } from "@repo/core/lib/schemas/abandoned-checkouts";

export function useAbandonedCheckouts(filters: AbandonedCheckoutFilters) {
  return useQuery({
    queryKey: query_keys.abandoned_checkouts(filters),
    queryFn: async () => unwrap(await getAbandonedCheckouts(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useSendAbandonedCheckoutEmail() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (session_id: string) => unwrap(await sendAbandonedCheckoutEmail(session_id)),
    onSettled: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.abandoned_checkouts_all }),
        query_client.invalidateQueries({ queryKey: ["email_log"] }),
      ]),
  });
}
