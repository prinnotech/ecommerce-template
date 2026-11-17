"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

export type AnnouncementMessage = { text: string; href: string };

type AnnouncementBarProps = {
  messages: AnnouncementMessage[];
  // Seconds per message; 0 = only the arrows change it.
  autoplay_seconds: number;
  className?: string;
  labels: { previous: string; next: string };
};

// One message at a time, with arrows when there are several (Shopify's announcement bar).
// Autoplay pauses while the pointer is over the bar or something in it has focus.
export function AnnouncementBar({ messages, autoplay_seconds, className, labels }: AnnouncementBarProps) {
  const [index, setIndex] = useState(0);
  const [is_paused, setIsPaused] = useState(false);
  const count = messages.length;
  const current = messages[index % count];

  useEffect(() => {
    if (count < 2 || autoplay_seconds === 0 || is_paused) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), autoplay_seconds * 1000);
    return () => clearInterval(timer);
  }, [count, autoplay_seconds, is_paused]);

  if (!current) return null;
  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);

  return (
    <div
      className={cn("px-4 py-2 text-xs font-medium tracking-wide sm:text-sm", className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
        {count > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={labels.previous}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </button>
        )}
        <p aria-live={autoplay_seconds === 0 ? "polite" : "off"} className="min-w-0 flex-1 truncate text-center">
          {current.href ? (
            <Link href={current.href} className="underline-offset-4 hover:underline">
              {current.text}
            </Link>
          ) : (
            current.text
          )}
        </p>
        {count > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={labels.next}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <ChevronRightIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
