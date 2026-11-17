"use client";

import { EyeIcon, EyeOffIcon, MegaphoneIcon, PanelBottomIcon, PanelTopIcon, type LucideIcon } from "lucide-react";

import type { GroupId } from "@repo/core/lib/schemas/theme";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

const ICONS: Record<GroupId, LucideIcon> = {
  "group:announcement": MegaphoneIcon,
  "group:header": PanelTopIcon,
  "group:footer": PanelBottomIcon,
};

export type GroupEntry = {
  id: GroupId;
  label: string;
  // Only the announcement bar can be hidden; the header and footer are always there.
  is_hidden?: boolean;
  onToggleHidden?: () => void;
};

type GroupListProps = {
  title: string;
  entries: GroupEntry[];
  onSelect: (id: GroupId) => void;
  labels: { show: string; hide: string; hidden: string };
  is_disabled: boolean;
};

// "Header" and "Footer" in the editor's outline, around the page's sections (Shopify-style).
export function GroupList({ title, entries, onSelect, labels, is_disabled }: GroupListProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-muted-foreground px-1 pb-1 text-xs font-medium tracking-wide uppercase">{title}</h2>
      <ul className="flex flex-col">
        {entries.map((entry) => {
          const Icon = ICONS[entry.id];
          return (
            <li
              key={entry.id}
              className={cn(
                "group hover:bg-muted flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-6",
                entry.is_hidden && "text-muted-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left"
              >
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{entry.label}</span>
                  {entry.is_hidden && <span className="text-muted-foreground block text-xs">{labels.hidden}</span>}
                </span>
              </button>
              {entry.onToggleHidden && !is_disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={entry.is_hidden ? labels.show : labels.hide}
                  aria-pressed={entry.is_hidden}
                  className={cn(!entry.is_hidden && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
                  onClick={entry.onToggleHidden}
                >
                  {entry.is_hidden ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
