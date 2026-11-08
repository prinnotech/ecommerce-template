import { cn } from "@repo/ui/lib/utils";

export type TimelineEntry = {
  id: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  // Already formatted for the admin's language and timezone.
  time: string;
  is_highlighted?: boolean;
};

// The event history on order and customer pages, newest first.
export function Timeline({ entries, label }: { entries: TimelineEntry[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < entries.length - 1 && (
            <span aria-hidden className="bg-border absolute top-3 left-[5px] h-full w-px" />
          )}
          <span
            aria-hidden
            className={cn(
              "relative mt-1.5 size-[11px] shrink-0 rounded-full border-2",
              entry.is_highlighted ? "border-primary bg-primary" : "border-muted-foreground/50 bg-background",
            )}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm">{entry.title}</p>
              {entry.body && <div className="text-muted-foreground text-xs">{entry.body}</div>}
            </div>
            <time className="text-muted-foreground shrink-0 text-xs tabular-nums">{entry.time}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
