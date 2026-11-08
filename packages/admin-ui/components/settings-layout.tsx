"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@repo/ui/lib/utils";

export type SettingsSection = { key: string; href: string; label: string; description?: string };

type SettingsLayoutProps = {
  sections: SettingsSection[];
  label: string;
  children: React.ReactNode;
};

// Shopify's settings: the section list on the left, the open section on the right. On phones the
// list scrolls sideways above the content.
export function SettingsLayout({ sections, label, children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:px-0">
        <ul className="flex gap-1 md:flex-col">
          {sections.map((section) => {
            const is_active = pathname === section.href || pathname.startsWith(`${section.href}/`);
            return (
              <li key={section.key} className="shrink-0">
                <Link
                  href={section.href}
                  aria-current={is_active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/50 block rounded-md px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3",
                    is_active
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}
