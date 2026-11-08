import { cn } from "@repo/ui/lib/utils";

import { STATUS_DOT_CLASSES, STATUS_TONE_CLASSES, type StatusTone } from "@repo/core/lib/order-tones";

// Tones and their classes are shared with the shop (lib/order-tones.ts).
export type { StatusTone };

type StatusBadgeProps = {
  tone: StatusTone;
  children: React.ReactNode;
  // A dot before the label so the state isn't shown by color alone (hollow = open, filled = done).
  has_dot?: boolean;
  className?: string;
};

export function StatusBadge({ tone, children, has_dot = true, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        STATUS_TONE_CLASSES[tone],
        className,
      )}
    >
      {has_dot && <span aria-hidden className={cn("size-1.5 rounded-full border", STATUS_DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}
