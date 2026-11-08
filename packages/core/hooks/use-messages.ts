"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  bulkSetMessageStatus,
  getMessages,
  setMessageStatus,
  submitContactMessage,
  subscribeNewsletter,
} from "@repo/core/actions/contact";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type {
  BulkMessageStatusInput,
  ContactMessageInput,
  MessageFilters,
  NewsletterSignupInput,
  SetMessageStatusInput,
} from "@repo/core/lib/schemas/contact";

export function useSubmitContactMessage() {
  return useMutation({ mutationFn: async (input: ContactMessageInput) => unwrap(await submitContactMessage(input)) });
}

export function useSubscribeNewsletter() {
  return useMutation({ mutationFn: async (input: NewsletterSignupInput) => unwrap(await subscribeNewsletter(input)) });
}

export function useMessages(filters: MessageFilters) {
  return useQuery({
    queryKey: query_keys.messages(filters),
    queryFn: async () => unwrap(await getMessages(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useSetMessageStatus() {
  const query_client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: SetMessageStatusInput) => unwrap(await setMessageStatus(input)),
    onSuccess: () => {
      // The sidebar's unread badge is rendered by the server layout.
      router.refresh();
      return query_client.invalidateQueries({ queryKey: query_keys.messages_all });
    },
  });
}

export function useBulkSetMessageStatus() {
  const query_client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: BulkMessageStatusInput) => unwrap(await bulkSetMessageStatus(input)),
    onSuccess: () => {
      router.refresh();
      return query_client.invalidateQueries({ queryKey: query_keys.messages_all });
    },
  });
}
