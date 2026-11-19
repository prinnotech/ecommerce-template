"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMessageLog,
  getMessaging,
  getOrderMessages,
  saveMessaging,
  sendMessagingTest,
  type SaveMessagingInput,
} from "@repo/core/actions/messaging";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";

export function useMessaging() {
  return useQuery({ queryKey: query_keys.messaging, queryFn: async () => unwrap(await getMessaging()) });
}

export function useSaveMessaging() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveMessagingInput) => unwrap(await saveMessaging(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.messaging }),
  });
}

export function useSendMessagingTest() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { channel: "sms" | "whatsapp"; to: string }) => unwrap(await sendMessagingTest(input)),
    onSettled: () => query_client.invalidateQueries({ queryKey: ["message_log"] }),
  });
}

export function useMessageLog(page: number) {
  return useQuery({
    queryKey: query_keys.message_log(page),
    queryFn: async () => unwrap(await getMessageLog({ page })),
    placeholderData: keepPreviousData,
  });
}

export function useOrderMessages(order_id: string) {
  return useQuery({
    queryKey: query_keys.order_messages(order_id),
    queryFn: async () => unwrap(await getOrderMessages({ order_id })),
  });
}
