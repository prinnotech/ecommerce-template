"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeDraftOrder,
  createDraftOrder,
  deleteDraftOrder,
  getDraftOrder,
  getDraftOrders,
  saveDraftOrder,
  searchDraftCustomers,
  searchDraftVariants,
  sendDraftInvoice,
} from "@repo/core/actions/draft-orders";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { DraftFieldsInput, DraftListFilters } from "@repo/core/lib/schemas/draft-orders";

export function useDraftOrders(filters: DraftListFilters) {
  return useQuery({
    queryKey: query_keys.draft_orders(filters),
    queryFn: async () => unwrap(await getDraftOrders(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useDraftOrder(id: string) {
  return useQuery({ queryKey: query_keys.draft_order(id), queryFn: async () => unwrap(await getDraftOrder(id)) });
}

export function useCreateDraftOrder() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await createDraftOrder()),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.draft_orders_all }),
  });
}

export function useSaveDraftOrder(id: string) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (draft: DraftFieldsInput) => unwrap(await saveDraftOrder({ id, draft })),
    onSuccess: (view) => {
      query_client.setQueryData(query_keys.draft_order(id), view);
      return query_client.invalidateQueries({
        queryKey: query_keys.draft_orders_all,
        predicate: (query) => query.queryKey[1] !== id,
      });
    },
  });
}

export function useDeleteDraftOrder() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteDraftOrder(id)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.draft_orders_all }),
  });
}

export function useSendDraftInvoice(id: string) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await sendDraftInvoice(id)),
    onSettled: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.draft_orders_all }),
        query_client.invalidateQueries({ queryKey: ["email_log"] }),
      ]),
  });
}

export function useCompleteDraftOrder(id: string) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (is_paid: boolean) => unwrap(await completeDraftOrder({ id, is_paid })),
    onSuccess: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.draft_orders_all }),
        query_client.invalidateQueries({ queryKey: query_keys.admin_orders_all }),
        query_client.invalidateQueries({ queryKey: query_keys.inventory_all }),
      ]),
  });
}

export function useDraftVariantSearch(search: string) {
  return useQuery({
    queryKey: query_keys.draft_variant_search(search),
    queryFn: async () => unwrap(await searchDraftVariants({ search })),
    placeholderData: keepPreviousData,
  });
}

export function useDraftCustomerSearch(search: string) {
  return useQuery({
    queryKey: query_keys.draft_customer_search(search),
    queryFn: async () => unwrap(await searchDraftCustomers({ search })),
    enabled: search.trim().length >= 2,
  });
}
