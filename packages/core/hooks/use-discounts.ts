"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDiscount,
  deleteDiscount,
  getDiscount,
  getDiscounts,
  updateDiscount,
  type DiscountInputValue,
} from "@repo/core/actions/discounts";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { DiscountListFilters } from "@repo/core/lib/schemas/discounts";

export function useDiscounts(filters: DiscountListFilters) {
  return useQuery({
    queryKey: query_keys.discounts(filters),
    queryFn: async () => unwrap(await getDiscounts(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useDiscount(id: string) {
  return useQuery({ queryKey: query_keys.discount(id), queryFn: async () => unwrap(await getDiscount(id)) });
}

export function useCreateDiscount() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (discount: DiscountInputValue) => unwrap(await createDiscount(discount)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.discounts_all }),
  });
}

export function useUpdateDiscount(id: string) {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (discount: DiscountInputValue) => unwrap(await updateDiscount({ id, discount })),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.discounts_all }),
  });
}

export function useDeleteDiscount() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteDiscount(id)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.discounts_all }),
  });
}
