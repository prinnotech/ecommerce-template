"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getActivityLog } from "@repo/core/actions/activity";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { ActivityFilters } from "@repo/core/lib/schemas/admin";

export function useActivityLog(filters: ActivityFilters) {
  return useQuery({
    queryKey: query_keys.activity(filters),
    queryFn: async () => unwrap(await getActivityLog(filters)),
    placeholderData: keepPreviousData,
  });
}
