"use client";

import { EyeOffIcon, MessageSquareIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import type { AdminOrderDetail } from "@repo/core/actions/orders";
import type { MessageLogEntry } from "@repo/core/backend/types";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useOrderMessages } from "@repo/core/hooks/use-messaging";
import { useAddOrderNote } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { cn } from "@repo/ui/lib/utils";
import { formatDateTime } from "@repo/core/lib/utils/format";

type OrderTimelineProps = {
  lang: string;
  order: AdminOrderDetail;
  can_edit: boolean;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  order_status: AdminDictionary["order_status"];
  payment_status: AdminDictionary["payment_status"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

function statusLabel(
  value: string,
  order_status: AdminDictionary["order_status"],
  payment_status: AdminDictionary["payment_status"],
): string {
  if (value in order_status) return order_status[value as keyof AdminDictionary["order_status"]];
  if (value in payment_status) return payment_status[value as keyof AdminDictionary["payment_status"]];
  return value;
}

export function OrderTimeline({
  lang,
  order,
  can_edit,
  dictionary,
  order_status,
  payment_status,
  common,
  errors,
}: OrderTimelineProps) {
  const add_note = useAddOrderNote();
  const messages = useOrderMessages(order.id);
  const [message, setMessage] = useState("");
  const [is_customer_visible, setIsCustomerVisible] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    add_note.mutate(
      { id: order.id, message: message.trim(), is_customer_visible },
      {
        onSuccess: () => {
          setMessage("");
          toast.success(dictionary.note_added);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function eventTitle(event: AdminOrderDetail["events"][number]): string {
    const template = dictionary.events[event.type];
    return template
      .replace("{from}", statusLabel(event.from_status, order_status, payment_status).toLowerCase())
      .replace("{to}", statusLabel(event.to_status, order_status, payment_status).toLowerCase());
  }

  function messageTitle(message: MessageLogEntry): string {
    const template =
      message.status === "sent"
        ? dictionary.message_sent
        : message.status === "failed"
          ? dictionary.message_failed
          : dictionary.message_skipped;
    return template
      .replace("{channel}", dictionary.message_channels[message.channel])
      .replace("{recipient}", message.recipient);
  }

  // Order events and the SMS/WhatsApp messages sent for the order, newest first.
  const entries = [
    ...order.events.map((event) => ({ kind: "event" as const, created_at: event.created_at, event })),
    ...(messages.data ?? []).map((message) => ({ kind: "message" as const, created_at: message.created_at, message })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-5">
      {can_edit && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-lg border p-3">
          <label htmlFor="order-note" className="sr-only">
            {dictionary.note_label}
          </label>
          <Textarea
            id="order-note"
            rows={2}
            value={message}
            maxLength={2000}
            placeholder={dictionary.note_placeholder}
            onChange={(event) => setMessage(event.target.value)}
            className="resize-none border-0 p-0 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={is_customer_visible}
                onChange={(event) => setIsCustomerVisible(event.target.checked)}
                className="accent-primary size-3.5"
              />
              {dictionary.visible_to_customer}
            </label>
            <Button type="submit" size="sm" disabled={!message.trim() || add_note.isPending}>
              {add_note.isPending && <Spinner aria-label={common.loading} />}
              {dictionary.post}
            </Button>
          </div>
        </form>
      )}

      <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
        {entries.map((entry, index) =>
          entry.kind === "message" ? (
            <li key={`message-${entry.message.id}`} className="relative flex flex-col gap-1">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 -left-6 size-[11px] rounded-full border-2 border-background",
                  index === 0 ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <MessageSquareIcon className="text-muted-foreground size-3.5" aria-hidden />
                  {messageTitle(entry.message)}
                </p>
                <time className="text-muted-foreground text-xs" dateTime={entry.created_at}>
                  {formatDateTime(entry.created_at, lang)}
                </time>
              </div>
              {entry.message.body && (
                <p className="text-muted-foreground text-sm whitespace-pre-line">{entry.message.body}</p>
              )}
              {entry.message.error && <p className="text-destructive text-xs">{entry.message.error}</p>}
            </li>
          ) : (
            <li key={entry.event.id} className="relative flex flex-col gap-1">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 -left-6 size-[11px] rounded-full border-2 border-background",
                  index === 0 ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium">{eventTitle(entry.event)}</p>
                <time className="text-muted-foreground text-xs" dateTime={entry.created_at}>
                  {formatDateTime(entry.created_at, lang)}
                </time>
              </div>
              {entry.event.message && (
                <p className="text-muted-foreground text-sm whitespace-pre-line">{entry.event.message}</p>
              )}
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                {entry.event.actor_name && <span>{dictionary.by.replace("{name}", entry.event.actor_name)}</span>}
                {!entry.event.is_customer_visible && (
                  <span className="flex items-center gap-1">
                    <EyeOffIcon className="size-3" aria-hidden />
                    {dictionary.internal}
                  </span>
                )}
              </p>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
