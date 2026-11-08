import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@repo/ui/lib/utils";

type PageProps = {
  title: React.ReactNode;
  // Next to the title: status badges, the order date…
  title_meta?: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  // Right side of the header: the main button last (Shopify order), secondary ones before it.
  primary_action?: React.ReactNode;
  secondary_actions?: React.ReactNode;
  // Under the header, e.g. tabs for a page with sections.
  tabs?: React.ReactNode;
  // "narrow" for forms and settings, "full" for index tables, "default" for detail pages.
  width?: "narrow" | "default" | "full";
  children: React.ReactNode;
};

const WIDTHS = { narrow: "max-w-3xl", default: "max-w-5xl", full: "max-w-7xl" };

// Every admin page starts with this: title, back link, actions.
export function Page({
  title,
  title_meta,
  subtitle,
  back,
  primary_action,
  secondary_actions,
  tabs,
  width = "default",
  children,
}: PageProps) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-5", WIDTHS[width])}>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {back && (
              <Link
                href={back.href}
                aria-label={back.label}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-3"
              >
                <ArrowLeftIcon className="size-4" />
              </Link>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
                {title_meta}
              </div>
              {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
            </div>
          </div>
          {(primary_action || secondary_actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {secondary_actions}
              {primary_action}
            </div>
          )}
        </div>
        {tabs}
      </header>
      {children}
    </div>
  );
}
