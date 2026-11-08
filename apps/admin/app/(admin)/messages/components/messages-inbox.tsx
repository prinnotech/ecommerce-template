"use client";

import { ArchiveIcon, ArrowLeftIcon, InboxIcon, MailIcon, MailOpenIcon, PhoneIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { IndexTable, type BulkAction, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import type { InboxMessage } from "@repo/core/actions/contact";
import { useBulkSetMessageStatus, useMessages, useSetMessageStatus } from "@repo/core/hooks/use-messages";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { message_filters_schema, type MessageFilters, type MessageStatus } from "@repo/core/lib/schemas/contact";
import { formatDateTime, formatPlural, formatRelativeTime } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

const TABS = ["inbox", "new", "read", "archived"] as const;

type MessagesInboxProps = {
  lang: string;
  dictionary: AdminDictionary["messages"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Two-pane inbox (list + reader) on desktop; on phones the reader replaces the list.
export function MessagesInbox({ lang, dictionary, index_table, common, errors }: MessagesInboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = message_filters_schema.parse(Object.fromEntries(search_params));
  const messages = useMessages(filters);
  const set_status = useSetMessageStatus();
  const bulk_status = useBulkSetMessageStatus();
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

  function handleBulk(ids: string[], status: MessageStatus) {
    bulk_status.mutate(
      { ids, status },
      {
        onSuccess: (result) => {
          setOpened(null);
          toast.success(formatPlural(result.count, dictionary.bulk_updated, lang));
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  const views: IndexView[] = TABS.map((tab) => ({ key: tab, label: dictionary.tabs[tab] }));

  const columns: IndexColumn<InboxMessage>[] = [
    {
      key: "from",
      header: dictionary.title,
      is_primary: true,
      cell: (message) => {
        const is_unread = message.status === "new";
        return (
          // The table wraps this in the row's button (onRowClick), so it's plain content.
          <span className="flex w-full flex-col gap-0.5 font-normal">
            <span className="flex items-center gap-2">
              {is_unread && <span className="bg-primary size-2 shrink-0 rounded-full" aria-hidden />}
              <span className={cn("truncate", is_unread && "font-semibold")}>{message.name}</span>
            </span>
            <span className={cn("truncate", !is_unread && "text-muted-foreground")}>
              {message.subject || dictionary.no_subject}
            </span>
            <span className="text-muted-foreground line-clamp-1 text-xs">{message.message}</span>
          </span>
        );
      },
    },
    {
      key: "time",
      header: "",
      align: "end",
      min_width: "sm",
      cell: (message) => (
        <time className="text-muted-foreground text-xs" dateTime={message.created_at}>
          {formatRelativeTime(message.created_at, lang)}
        </time>
      ),
    },
  ];

  const bulk_actions: BulkAction[] = [
    { key: "read", label: dictionary.mark_read, onSelect: (ids) => handleBulk(ids, "read") },
    { key: "archive", label: dictionary.archive, onSelect: (ids) => handleBulk(ids, "archived") },
  ];

  function renderMobileRow(message: InboxMessage) {
    const is_unread = message.status === "new";
    return (
      <div className="flex flex-col gap-0.5">
        <span className={cn("flex items-center gap-2 text-sm", is_unread && "font-semibold")}>
          {is_unread && <span className="bg-primary size-2 shrink-0 rounded-full" aria-hidden />}
          <span className="truncate">{message.name}</span>
        </span>
        <span className="text-muted-foreground truncate text-sm">{message.subject || dictionary.no_subject}</span>
        <time className="text-muted-foreground text-xs" dateTime={message.created_at}>
          {formatRelativeTime(message.created_at, lang)}
        </time>
      </div>
    );
  }

  return (
    <Page title={dictionary.title} width="full">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn(selected && "hidden lg:block")}>
          <IndexTable
            lang={lang}
            rows={messages.data?.items ?? []}
            getRowId={(message) => message.id}
            columns={columns}
            resource_label={dictionary.title}
            views={views}
            active_view={filters.status}
            onViewChange={(key) => setFilters({ status: key as MessageStatus })}
            bulk_actions={bulk_actions}
            page={messages.data?.page ?? filters.page}
            total_pages={messages.data?.total_pages ?? 1}
            onPageChange={(page) => setFilters({ page })}
            summary={messages.data ? formatPlural(messages.data.total_items, dictionary.results, lang) : undefined}
            is_loading={messages.isFetching}
            empty_state={<p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>}
            renderMobileRow={renderMobileRow}
            onRowClick={open}
            dictionary={index_table}
          />
          {messages.isError && <p className="text-destructive text-sm">{errorText(errors, messages.error)}</p>}
        </div>

        <div className={cn(!selected && "hidden lg:block")}>
          <SectionCard>
            {selected ? (
              <article className="flex flex-col gap-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 self-start lg:hidden"
                  onClick={() => setOpened(null)}
                >
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
              <p className="text-muted-foreground flex h-full min-h-40 items-center justify-center p-10 text-sm">
                {dictionary.select}
              </p>
            )}
          </SectionCard>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {set_status.isPending ? common.loading : ""}
      </span>
    </Page>
  );
}
