"use client";

import { useState } from "react";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { MessageLogEntry } from "@repo/core/backend/types";
import { useMessageLog } from "@repo/core/hooks/use-messaging";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { StatusTone } from "@repo/core/lib/order-tones";
import { isMessageEvent } from "@repo/core/lib/schemas/messaging";
import { formatDateTime } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";

type Dictionary = AdminDictionary["sms_settings"];

const STATUS_TONES: Record<MessageLogEntry["status"], StatusTone> = {
  sent: "success",
  failed: "critical",
  skipped: "neutral",
};

function reasonText(error: string, dictionary: Dictionary): string {
  return error in dictionary.reasons ? dictionary.reasons[error as keyof Dictionary["reasons"]] : error;
}

// The last messages sent (or refused), newest first, 20 per page.
export function MessageLogCard({
  lang,
  dictionary,
  common,
  errors,
}: {
  lang: string;
  dictionary: Dictionary;
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
}) {
  const [page, setPage] = useState(1);
  const log = useMessageLog(page);

  return (
    <SectionCard title={dictionary.log_title} is_flush>
      {log.isPending ? (
        <div className="p-4">
          <Skeleton className="h-24" />
        </div>
      ) : log.isError ? (
        <p className="text-destructive p-4 text-sm">{errorText(errors, log.error)}</p>
      ) : log.data.items.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">{dictionary.log_empty}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{dictionary.log_date}</TableHead>
                  <TableHead>{dictionary.log_channel}</TableHead>
                  <TableHead>{dictionary.log_event}</TableHead>
                  <TableHead>{dictionary.log_recipient}</TableHead>
                  <TableHead className="pr-4">{dictionary.log_status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground pl-4 whitespace-nowrap">
                      {formatDateTime(entry.created_at, lang)}
                    </TableCell>
                    <TableCell>
                      {entry.channel === "whatsapp" ? dictionary.channel_whatsapp : dictionary.channel_sms}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isMessageEvent(entry.event) ? dictionary.events[entry.event].label : dictionary.log_test}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.recipient}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge tone={STATUS_TONES[entry.status]}>{dictionary.status[entry.status]}</StatusBadge>
                        {entry.error && (
                          <span className="text-muted-foreground max-w-64 text-xs whitespace-normal">
                            {reasonText(entry.error, dictionary)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {log.data.total_pages > 1 && (
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {common.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= log.data.total_pages}
                onClick={() => setPage(page + 1)}
              >
                {common.next}
              </Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
