"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  exportCustomersCsv,
  getCustomerNote,
  getCustomers,
  setCustomerMarketing,
  updateCustomerNote,
} from "@repo/core/actions/customers";
import { countSegment, deleteSegment, getSegments, saveSegment } from "@repo/core/actions/segments";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { CustomerListFilters, CustomerMarketingInput, CustomerNoteInput } from "@repo/core/lib/schemas/customers";
import type { SegmentInput, SegmentRules } from "@repo/core/lib/schemas/segments";

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

// Returns the CSV text; the caller hands it to the browser as a download.
export function useExportCustomers() {
  return useMutation({ mutationFn: async (filters: CustomerListFilters) => unwrap(await exportCustomersCsv(filters)) });
}

export function useSegments() {
  return useQuery({ queryKey: query_keys.segments, queryFn: async () => unwrap(await getSegments()) });
}

// Live count while the rules are edited (only once they're valid).
export function useSegmentCount(rules: SegmentRules | null) {
  return useQuery({
    queryKey: query_keys.segment_count(rules),
    queryFn: async () => unwrap(await countSegment(rules!)),
    enabled: rules !== null,
    placeholderData: keepPreviousData,
  });
}

export function useSaveSegment() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string | null; segment: SegmentInput }) => unwrap(await saveSegment(input)),
    onSuccess: () =>
      Promise.all([
        query_client.invalidateQueries({ queryKey: query_keys.segments }),
        query_client.invalidateQueries({ queryKey: query_keys.admin_customers_all }),
      ]),
  });
}

export function useDeleteSegment() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteSegment(id)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.segments }),
  });
}
