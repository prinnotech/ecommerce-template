"use client";

import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-auth";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AccountNavProps = {
  lang: string;
  dictionary: Dictionary["account"]["nav"];
  errors: Dictionary["errors"];
};

export function AccountNav({ lang, dictionary, errors }: AccountNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sign_out = useSignOut();
  const base = `/${lang}/account`;

  const links = [
    { href: base, label: dictionary.overview, is_active: pathname === base },
    { href: `${base}/orders`, label: dictionary.orders, is_active: pathname.startsWith(`${base}/orders`) },
    { href: `${base}/addresses`, label: dictionary.addresses, is_active: pathname.startsWith(`${base}/addresses`) },
    { href: `${base}/profile`, label: dictionary.profile, is_active: pathname.startsWith(`${base}/profile`) },
  ];

  function onSignOut() {
    sign_out.mutate(undefined, {
      onSuccess: () => {
        router.replace(`/${lang}`);
        router.refresh();
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b">
      <nav aria-label={dictionary.label} className="-mb-px flex gap-1 overflow-x-auto">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.is_active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              link.is_active
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground shrink-0"
        onClick={onSignOut}
        disabled={sign_out.isPending}
      >
        <LogOutIcon />
        <span className="max-sm:sr-only">{dictionary.sign_out}</span>
      </Button>
    </div>
  );
}
