"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getPaymentsOverview,
  savePaymentMethods,
  saveStripeKeys,
  type StripeKeysInput,
} from "@repo/core/actions/payments";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { PaymentMethodConfig } from "@repo/core/lib/schemas/payments";

export function usePaymentsOverview() {
  return useQuery({ queryKey: query_keys.payments, queryFn: async () => unwrap(await getPaymentsOverview()) });
}

function useInvalidatePayments() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.payments });
}

export function useSavePaymentMethods() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (methods: PaymentMethodConfig[]) => unwrap(await savePaymentMethods(methods)),
    onSuccess: () => invalidate(),
  });
}

export function useSaveStripeKeys() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (input: StripeKeysInput) => unwrap(await saveStripeKeys(input)),
    onSuccess: () => invalidate(),
  });
}
