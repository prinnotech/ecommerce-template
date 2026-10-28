"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, type Locale } from "@/i18nConfig";
import { switchLocalePath } from "@/lib/locale/switch-locale-path";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  lang: string;
  label: string;
  options: { value: Locale; label: string }[];
  // "header": flag + code, compact. "footer": flag + language name.
  variant?: "header" | "footer";
};

export function LanguageSwitcher({ lang, label, options, variant = "header" }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const current = options.find((option) => option.value === lang) ?? options[0];

  function onSelect(locale: Locale) {
    if (locale === lang) return;
    saveLocaleChoice(locale);
    // Read the query on click instead of useSearchParams, so static pages render this without Suspense.
    router.push(`${switchLocalePath(pathname, locale)}${window.location.search}`);
  }

  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "header" ? "ghost" : "outline"}
          size="sm"
          aria-label={`${label}: ${current.label}`}
          className={cn("gap-1.5", variant === "header" && "px-2")}
        >
          <Flag locale={current.value} />
          <span className={cn(variant === "header" && "hidden text-xs font-semibold uppercase sm:inline")}>
            {variant === "header" ? current.value : current.label}
          </span>
          <ChevronDownIcon className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onSelect(option.value)} lang={option.value}>
            <Flag locale={option.value} />
            <span className="flex-1">{option.label}</span>
            {option.value === lang && <CheckIcon className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Remember the choice so the proxy doesn't switch back (by country or browser) on the next visit.
function saveLocaleChoice(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

// SVG files instead of emoji: Windows doesn't render flag emoji.
function Flag({ locale }: { locale: Locale }) {
  return (
    <Image
      src={`/flags/${locale}.svg`}
      alt=""
      width={20}
      height={14}
      unoptimized
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px] shadow-border"
    />
  );
}
