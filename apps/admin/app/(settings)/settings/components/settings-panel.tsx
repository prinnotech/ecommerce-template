"use client";

import { SettingsIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SETTINGS_RETURN_KEY } from "@/components/shell/settings-return";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export type SettingsPanelGroup = { key: string; label: string; items: { key: string; href: string; label: string }[] };

type SettingsPanelProps = {
  title: string;
  site_name: string;
  close_label: string;
  groups: SettingsPanelGroup[];
  children: React.ReactNode;
};

function returnPath(): string {
  try {
    const path = sessionStorage.getItem(SETTINGS_RETURN_KEY);
    return path && path.startsWith("/") && !path.startsWith("/settings") ? path : "/";
  } catch {
    // Storage blocked (private mode): back to the dashboard.
    return "/";
  }
}

// Shopify-style settings: a full-screen panel over the admin, its sections grouped on the left.
export function SettingsPanel({ title, site_name, close_label, groups, children }: SettingsPanelProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col">
      <header className="bg-background sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SettingsIcon className="text-muted-foreground size-5" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground truncate text-xs">{site_name}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={close_label}
          onClick={() => router.push(returnPath())}
        >
          <XIcon />
        </Button>
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 px-4 py-6 md:grid-cols-[15rem_minmax(0,1fr)] md:px-6">
        <nav aria-label={title} className="-mx-4 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:px-0">
          <div className="flex gap-4 md:flex-col md:gap-5">
            {groups.map((group) => (
              <div key={group.key} className="flex shrink-0 flex-col gap-1">
                <p className="text-muted-foreground hidden px-3 text-xs font-medium tracking-wide uppercase md:block">
                  {group.label}
                </p>
                <ul className="flex gap-1 md:flex-col">
                  {group.items.map((item) => {
                    const is_active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.key} className="shrink-0">
                        <Link
                          href={item.href}
                          aria-current={is_active ? "page" : undefined}
                          className={cn(
                            "focus-visible:ring-ring/50 block rounded-md px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3",
                            is_active
                              ? "bg-background font-medium shadow-xs"
                              : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <main id="admin-main" className="flex min-w-0 flex-col gap-4">
          {children}
        </main>
      </div>
    </div>
  );
}
