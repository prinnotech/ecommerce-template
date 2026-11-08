"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import type { DnsRecord } from "@repo/core/backend/types";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";

type DnsRecordsProps = {
  records: DnsRecord[];
  dictionary: AdminDictionary["domains"];
};

// The records to create at the registrar, each value with a copy button (names and values are
// long and easy to mistype). Stacks on phones.
export function DnsRecords({ records, dictionary }: DnsRecordsProps) {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(dictionary.copied);
    } catch {
      // Clipboard blocked (insecure origin, permissions): the value is still selectable on screen.
    }
  }

  if (records.length === 0) return <p className="text-muted-foreground text-xs">{dictionary.records_none}</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">{dictionary.records_hint}</p>
      <dl className="divide-y rounded-lg border">
        {records.map((record, index) => (
          <div
            key={`${record.type}-${record.name}-${index}`}
            className="grid gap-2 p-3 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,2fr)]"
          >
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{dictionary.columns.type}</dt>
              <dd className="font-mono text-sm font-medium">{record.type}</dd>
            </div>
            {(["name", "value"] as const).map((field) => (
              <div key={field} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">{dictionary.columns[field]}</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <code className="bg-muted min-w-0 flex-1 rounded px-2 py-1 font-mono text-xs break-all select-all">
                    {record[field]}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => copy(record[field])}
                    aria-label={dictionary.copy.replace("{field}", dictionary.columns[field])}
                  >
                    <CopyIcon />
                  </Button>
                </dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
    </div>
  );
}
