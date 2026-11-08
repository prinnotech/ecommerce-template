import Link from "next/link";
import type { ReactNode } from "react";

import { RichText } from "@/components/storefront/rich-text";
import { Button } from "@repo/ui/components/ui/button";

type ContentPageProps = {
  eyebrow: string;
  title: string;
  // Admin-written text from site settings; empty shows the fallback.
  text: string;
  fallback: string;
  contact: { href: string; label: string };
  aside?: ReactNode;
};

// Shared layout for About, Privacy and Terms.
export function ContentPage({ eyebrow, title, text, fallback, contact, aside }: ContentPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <header className="mb-12 flex max-w-3xl flex-col gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{eyebrow}</p>
        <h1 className="font-display text-4xl leading-tight font-medium tracking-tight text-balance sm:text-6xl">
          {title}
        </h1>
      </header>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="max-w-3xl text-base sm:text-lg">
          {text.trim() ? (
            <RichText text={text} />
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-muted-foreground">{fallback}</p>
              <Button asChild variant="outline">
                <Link href={contact.href}>{contact.label}</Link>
              </Button>
            </div>
          )}
        </article>
        {aside && <aside className="lg:pt-2">{aside}</aside>}
      </div>
    </div>
  );
}
