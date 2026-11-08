"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addOrderNote,
  bulkFulfillOrders,
  exportOrdersCsv,
  getAdminOrder,
  getAdminOrders,
  markOrderPaid,
  refundOrder,
  updateInternalNote,
  updateOrderStatus,
  updateTracking,
} from "@repo/core/actions/orders";
import { unwrap, type ActionResult } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { BulkOrdersInput, OrderListFilters } from "@repo/core/lib/schemas/orders";

export function useAdminOrders(filters: OrderListFilters) {
  return useQuery({
    queryKey: query_keys.admin_orders(filters),
    queryFn: async () => unwrap(await getAdminOrders(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrder(id: string) {
  return useQuery({ queryKey: query_keys.admin_order(id), queryFn: async () => unwrap(await getAdminOrder(id)) });
}

// Every order mutation refreshes that order (timeline included) and the lists.
function useOrderMutation<I extends { id: string }, T>(action: (input: I) => Promise<ActionResult<T>>) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: I) => unwrap(await action(input)),
    onSuccess: (_data, input) =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.admin_order(input.id) }),
        query_client.invalidateQueries({ queryKey: query_keys.admin_orders_all }),
      ]),
  });
}

export const useUpdateOrderStatus = () => useOrderMutation(updateOrderStatus);
export const useMarkOrderPaid = () => useOrderMutation(markOrderPaid);
export const useRefundOrder = () => useOrderMutation(refundOrder);
export const useUpdateTracking = () => useOrderMutation(updateTracking);
export const useAddOrderNote = () => useOrderMutation(addOrderNote);
export const useUpdateInternalNote = () => useOrderMutation(updateInternalNote);

export function useBulkFulfillOrders() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkOrdersInput) => unwrap(await bulkFulfillOrders(input)),
    onSuccess: (_data, input) =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.admin_orders_all }),
        ...input.ids.map((id) => query_client.invalidateQueries({ queryKey: query_keys.admin_order(id) })),
      ]),
  });
}

// Returns the CSV text; the caller hands it to the browser as a download.
export function useExportOrders() {
  return useMutation({ mutationFn: async (filters: OrderListFilters) => unwrap(await exportOrdersCsv(filters)) });
}
