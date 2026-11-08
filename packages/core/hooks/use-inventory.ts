"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adjustStock, getInventory, getStockHistory } from "@repo/core/actions/inventory";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { AdjustStockInput, InventoryFilters } from "@repo/core/lib/schemas/inventory";

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: query_keys.inventory(filters),
    queryFn: async () => unwrap(await getInventory(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useStockHistory(variant_id: string | null) {
  return useQuery({
    queryKey: query_keys.stock_history(variant_id ?? ""),
    queryFn: async () => unwrap(await getStockHistory({ variant_id: variant_id ?? "" })),
    enabled: Boolean(variant_id),
  });
}

export function useAdjustStock() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdjustStockInput) => unwrap(await adjustStock(input)),
    onSuccess: (_result, input) =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.inventory_all }),
        query_client.invalidateQueries({ queryKey: query_keys.stock_history(input.variant_id) }),
        query_client.invalidateQueries({ queryKey: query_keys.admin_products_all }),
      ]),
  });
}
