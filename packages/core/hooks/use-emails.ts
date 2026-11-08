"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getEmailLog,
  getEmailSending,
  getNotifications,
  previewEmail,
  saveNotifications,
  saveSmtp,
  sendSmtpTest,
  sendTemplateTest,
  type PreviewEmailInput,
  type SaveSmtpInput,
} from "@repo/core/actions/emails";
import { unwrap } from "@repo/core/lib/action-result";
import type { NotificationSettings } from "@repo/core/lib/email/templates";
import { query_keys } from "@repo/core/lib/query-keys";

const EMAIL_SENDING_KEY = ["email_sending"] as const;

export function useEmailSending() {
  return useQuery({ queryKey: EMAIL_SENDING_KEY, queryFn: async () => unwrap(await getEmailSending()) });
}

export function useSaveSmtp() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveSmtpInput) => unwrap(await saveSmtp(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: EMAIL_SENDING_KEY }),
  });
}

export function useSendSmtpTest() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (to: string) => unwrap(await sendSmtpTest({ to })),
    onSettled: () => query_client.invalidateQueries({ queryKey: ["email_log"] }),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: query_keys.notifications, queryFn: async () => unwrap(await getNotifications()) });
}

export function useSaveNotifications() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NotificationSettings) => unwrap(await saveNotifications(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.notifications }),
  });
}

export function usePreviewEmail() {
  return useMutation({ mutationFn: async (input: PreviewEmailInput) => unwrap(await previewEmail(input)) });
}

export function useSendTemplateTest() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: PreviewEmailInput) => unwrap(await sendTemplateTest(input)),
    onSettled: () => query_client.invalidateQueries({ queryKey: ["email_log"] }),
  });
}

export function useEmailLog(page: number) {
  return useQuery({
    queryKey: query_keys.email_log(page),
    queryFn: async () => unwrap(await getEmailLog({ page })),
    placeholderData: keepPreviousData,
  });
}
