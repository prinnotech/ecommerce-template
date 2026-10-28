"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { getCartLines } from "@/app/actions/cart";
import { completeCheckout, createCheckoutSession, quoteCheckout } from "@/app/actions/checkout";
import { unwrap } from "@/lib/action-result";
import { query_keys } from "@/lib/query-keys";
import type { CompleteCheckoutInput, CreateCheckoutInput, QuoteCheckoutInput } from "@/lib/schemas/checkout";
import type { CartLine } from "@/store/cart-store";

// Prices the cart (ids + quantities from Zustand) on the server.
export function useCartLines(lines: CartLine[], locale: string, is_ready: boolean) {
  return useQuery({
    queryKey: query_keys.cart_lines(lines, locale),
    queryFn: async () => unwrap(await getCartLines({ lines, locale })),
    enabled: is_ready && lines.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCreateCheckout() {
  return useMutation({ mutationFn: async (input: CreateCheckoutInput) => unwrap(await createCheckoutSession(input)) });
}

export function useQuoteCheckout() {
  return useMutation({ mutationFn: async (input: QuoteCheckoutInput) => unwrap(await quoteCheckout(input)) });
}

export function useCompleteCheckout() {
  return useMutation({ mutationFn: async (input: CompleteCheckoutInput) => unwrap(await completeCheckout(input)) });
}
