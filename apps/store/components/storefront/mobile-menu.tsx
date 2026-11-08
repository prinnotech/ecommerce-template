"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";

type NavLink = { href: string; label: string };
// A menu entry with an optional submenu (one level).
export type NavItem = NavLink & { children?: NavLink[] };

type MobileMenuProps = {
  site_name: string;
  links: NavItem[];
  secondary_links: NavLink[];
  labels: { open: string; title: string; close: string };
};

export function MobileMenu({ site_name, links, secondary_links, labels }: MobileMenuProps) {
  const [is_open, setIsOpen] = useState(false);

  return (
    <Sheet open={is_open} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.open}>
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" closeLabel={labels.close} className="w-[85vw] max-w-sm gap-0">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl">{site_name}</SheetTitle>
          <SheetDescription className="sr-only">{labels.title}</SheetDescription>
        </SheetHeader>
        <nav aria-label={labels.title} className="flex flex-1 flex-col overflow-y-auto p-2">
          {links.map((link, index) => (
            <div key={`${index}-${link.href}`} className="flex flex-col">
              <Link
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="hover:bg-muted rounded-md px-3 py-3 text-lg font-medium"
              >
                {link.label}
              </Link>
              {link.children?.map((child, child_index) => (
                <Link
                  key={`${child_index}-${child.href}`}
                  href={child.href}
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md py-2 pr-3 pl-7 text-base"
                >
                  {child.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-auto flex flex-col border-t pt-2">
            {secondary_links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2.5 text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
