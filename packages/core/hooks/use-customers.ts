"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getCustomerNote, getCustomers, setCustomerMarketing, updateCustomerNote } from "@repo/core/actions/customers";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { CustomerListFilters, CustomerMarketingInput, CustomerNoteInput } from "@repo/core/lib/schemas/customers";

export function useCustomers(filters: CustomerListFilters) {
  return useQuery({
    queryKey: query_keys.admin_customers(filters),
    queryFn: async () => unwrap(await getCustomers(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerNote(key: string) {
  return useQuery({ queryKey: query_keys.customer_note(key), queryFn: async () => unwrap(await getCustomerNote(key)) });
}

// Autosaved: the cache is updated with what was typed, so the field never jumps back.
export function useUpdateCustomerNote() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerNoteInput) => unwrap(await updateCustomerNote(input)),
    onSuccess: (_data, input) => query_client.setQueryData(query_keys.customer_note(input.key), input.note),
  });
}

// The customer page is server-rendered: refresh it to show the new consent.
export function useSetCustomerMarketing() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: CustomerMarketingInput) => unwrap(await setCustomerMarketing(input)),
    onSuccess: () => router.refresh(),
  });
}
