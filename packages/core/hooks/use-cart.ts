"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { getCartLines } from "@repo/core/actions/cart";
import {
  completeCheckout,
  createCheckoutSession,
  quoteCheckout,
  saveCheckoutContact,
} from "@repo/core/actions/checkout";
import { unwrap } from "@repo/core/lib/action-result";
import type { PricedCart } from "@repo/core/lib/checkout/checkout-server";
import { query_keys } from "@repo/core/lib/query-keys";
import type { CompleteCheckoutInput, CreateCheckoutInput, QuoteCheckoutInput } from "@repo/core/lib/schemas/checkout";
import type { CartLine } from "@repo/core/store/cart-store";

// Prices the cart (ids + quantities from Zustand) on the server. `initialData` lets a server
// component render the cart on the first paint (audit X8) instead of showing a placeholder.
export function useCartLines(lines: CartLine[], locale: string, is_ready: boolean, initial_data?: PricedCart) {
  return useQuery({
    queryKey: query_keys.cart_lines(lines, locale),
    queryFn: async () => unwrap(await getCartLines({ lines, locale })),
    enabled: is_ready && lines.length > 0,
    placeholderData: keepPreviousData,
    initialData: initial_data,
  });
}

export function useCreateCheckout() {
  return useMutation({ mutationFn: async (input: CreateCheckoutInput) => unwrap(await createCheckoutSession(input)) });
}

export function useQuoteCheckout() {
  return useMutation({ mutationFn: async (input: QuoteCheckoutInput) => unwrap(await quoteCheckout(input)) });
}

// Saves the email as soon as it's typed (for the abandoned-checkout reminder). Failures are silent:
// the checkout works without it.
export function useSaveCheckoutContact() {
  return useMutation({
    mutationFn: async (input: { session_id: string; email: string }) => unwrap(await saveCheckoutContact(input)),
  });
}

export function useCompleteCheckout() {
  return useMutation({ mutationFn: async (input: CompleteCheckoutInput) => unwrap(await completeCheckout(input)) });
}
