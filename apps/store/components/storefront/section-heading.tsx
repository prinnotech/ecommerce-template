import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

type SectionHeadingProps = {
  title: string;
  link?: { href: string; label: string };
};

export function SectionHeading({ title, link }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
      {link && (
        <Link
          href={link.href}
          className="group text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm font-medium"
        >
          {link.label}
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
