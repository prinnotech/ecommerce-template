"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getMessages, setMessageStatus, submitContactMessage } from "@/app/actions/contact";
import { unwrap } from "@/lib/action-result";
import { query_keys } from "@/lib/query-keys";
import type { ContactMessageInput, MessageFilters, SetMessageStatusInput } from "@/lib/schemas/contact";

export function useSubmitContactMessage() {
  return useMutation({ mutationFn: async (input: ContactMessageInput) => unwrap(await submitContactMessage(input)) });
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
