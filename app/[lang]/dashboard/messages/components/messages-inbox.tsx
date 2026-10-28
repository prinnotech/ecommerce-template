"use client";

import { ArchiveIcon, ArrowLeftIcon, InboxIcon, MailIcon, MailOpenIcon, PhoneIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { InboxMessage } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages, useSetMessageStatus } from "@/hooks/use-messages";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { message_filters_schema, type MessageFilters, type MessageStatus } from "@/lib/schemas/contact";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";

const TABS = ["inbox", "new", "read", "archived"] as const;

type MessagesInboxProps = {
  lang: string;
  dictionary: Dictionary["messages"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

// Two-pane inbox (list + reader) on desktop; on phones the reader replaces the list.
export function MessagesInbox({ lang, dictionary, common, errors }: MessagesInboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = message_filters_schema.parse(Object.fromEntries(search_params));
  const messages = useMessages(filters);
  const set_status = useSetMessageStatus();
  const [opened, setOpened] = useState<InboxMessage | null>(null);
  const selected_id = opened?.id ?? null;
  // Prefer the fresh copy from the list; keep the opened one if it left this folder (e.g. read in "Unread").
  const selected = messages.data?.items.find((message) => message.id === selected_id) ?? opened;

  function setFilters(patch: Partial<MessageFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.status !== "inbox") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    setOpened(null);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function changeStatus(message: InboxMessage, status: MessageStatus) {
    set_status.mutate(
      { id: message.id, status },
      {
        onSuccess: () => setOpened((current) => (current?.id === message.id ? { ...current, status } : current)),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  // Opening an unread message marks it as read, like an email client.
  function open(message: InboxMessage) {
    setOpened(message);
    if (message.status === "new") changeStatus(message, "read");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.title}</h1>

      <div role="group" aria-label={dictionary.tabs_label} className="flex w-max gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filters.status === tab}
            onClick={() => setFilters({ status: tab })}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              filters.status === tab
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {dictionary.tabs[tab]}
          </button>
        ))}
      </div>

      <Card className="grid min-h-[28rem] gap-0 overflow-hidden py-0 md:grid-cols-[22rem_minmax(0,1fr)]">
        <div className={cn("border-r md:block", selected && "hidden")}>
          {messages.isPending ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          ) : messages.isError ? (
            <p className="text-destructive p-6 text-sm">{errorText(errors, messages.error)}</p>
          ) : messages.data.items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 p-10 text-center text-sm">
              <InboxIcon className="size-6" strokeWidth={1.5} aria-hidden />
              {dictionary.empty}
            </div>
          ) : (
            <ul className="divide-y">
              {messages.data.items.map((message) => {
                const is_unread = message.status === "new";
                return (
                  <li key={message.id}>
                    <button
                      type="button"
                      onClick={() => open(message)}
                      aria-current={message.id === selected_id ? "true" : undefined}
                      className={cn(
                        "hover:bg-muted/50 flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors",
                        message.id === selected_id && "bg-muted",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("flex items-center gap-2 truncate text-sm", is_unread && "font-semibold")}>
                          {is_unread && (
                            <span className="bg-primary size-2 shrink-0 rounded-full">
                              <span className="sr-only">{dictionary.unread}</span>
                            </span>
                          )}
                          {message.name}
                        </span>
                        <time className="text-muted-foreground shrink-0 text-xs" dateTime={message.created_at}>
                          {formatRelativeTime(message.created_at, lang)}
                        </time>
                      </span>
                      <span className={cn("truncate text-sm", !is_unread && "text-muted-foreground")}>
                        {message.subject || dictionary.no_subject}
                      </span>
                      <span className="text-muted-foreground line-clamp-1 text-xs">{message.message}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={cn("md:block", !selected && "hidden")}>
          {selected ? (
            <article className="flex flex-col gap-6 p-6">
              <Button variant="ghost" size="sm" className="-ml-2 self-start md:hidden" onClick={() => setOpened(null)}>
                <ArrowLeftIcon />
                {dictionary.back}
              </Button>
              <header className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">{selected.subject || dictionary.no_subject}</h2>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{selected.name}</span>
                  <a
                    href={`mailto:${selected.email}`}
                    className="text-muted-foreground flex items-center gap-2 hover:underline"
                  >
                    <MailIcon className="size-3.5" aria-hidden />
                    {selected.email}
                  </a>
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone.replace(/\s+/g, "")}`}
                      className="text-muted-foreground flex items-center gap-2 hover:underline"
                    >
                      <PhoneIcon className="size-3.5" aria-hidden />
                      {selected.phone}
                    </a>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {dictionary.received.replace("{date}", formatDateTime(selected.created_at, lang))}
                  </span>
                </div>
              </header>
              <p className="text-sm leading-relaxed whitespace-pre-line">{selected.message}</p>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button asChild>
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject || ""}`.trim())}`}
                  >
                    <MailIcon />
                    {dictionary.reply}
                  </a>
                </Button>
                {selected.status !== "new" && selected.status !== "archived" && (
                  <Button
                    variant="outline"
                    disabled={set_status.isPending}
                    onClick={() => changeStatus(selected, "new")}
                  >
                    <MailOpenIcon />
                    {dictionary.mark_unread}
                  </Button>
                )}
                {selected.status === "archived" ? (
                  <Button
                    variant="outline"
                    disabled={set_status.isPending}
                    onClick={() => changeStatus(selected, "read")}
                  >
                    <InboxIcon />
                    {dictionary.unarchive}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={set_status.isPending}
                    onClick={() => {
                      changeStatus(selected, "archived");
                      setOpened(null);
                    }}
                  >
                    <ArchiveIcon />
                    {dictionary.archive}
                  </Button>
                )}
              </div>
            </article>
          ) : (
            <p className="text-muted-foreground flex h-full items-center justify-center p-10 text-sm">
              {dictionary.select}
            </p>
          )}
        </div>
      </Card>

      {messages.data && messages.data.total_pages > 1 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            {dictionary.results.replace("{count}", String(messages.data.total_items))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ page: filters.page - 1 })}
            >
              {dictionary.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= messages.data.total_pages}
              onClick={() => setFilters({ page: filters.page + 1 })}
            >
              {dictionary.next}
            </Button>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {set_status.isPending ? common.loading : ""}
      </span>
    </div>
  );
}
