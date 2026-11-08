"use client";

import { ExternalLinkIcon, LanguagesIcon, LogOutIcon, SearchIcon, SunMoonIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SearchDialog } from "@/components/shell/search-dialog";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";
import { useSetAdminLocale } from "@repo/core/hooks/use-admin";
import { useSignOut } from "@repo/core/hooks/use-auth";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { SITE_URL } from "@repo/core/lib/site-config";

type TopBarProps = {
  lang: Locale;
  site_name: string;
  user: { name: string; email: string };
  language_options: { value: Locale; label: string }[];
  dictionary: AdminDictionary["admin_shell"];
  toggle_sidebar_label: string;
  close_label: string;
  errors: AdminDictionary["errors"];
};

const THEMES = ["light", "dark", "system"] as const;

// Shopify-style top bar: menu button and store name on phones, global search in the middle,
// the staff member's menu (language, theme, store link, sign out) on the right.
export function TopBar({
  lang,
  site_name,
  user,
  language_options,
  dictionary,
  toggle_sidebar_label,
  close_label,
  errors,
}: TopBarProps) {
  const router = useRouter();
  const sign_out = useSignOut();
  const set_locale = useSetAdminLocale();
  const { theme, setTheme } = useTheme();
  const [is_search_open, setSearchOpen] = useState(false);
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  // Ctrl K / ⌘ K opens the search from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onLanguageChange(value: string) {
    set_locale.mutate(
      { locale: value as Locale },
      {
        // Server components render the dictionary: refresh them in the new language.
        onSuccess: () => router.refresh(),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function onSignOut() {
    sign_out.mutate(undefined, {
      onSuccess: () => {
        router.replace("/login");
        router.refresh();
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur md:px-4">
      <SidebarTrigger label={toggle_sidebar_label} className="md:hidden" />
      <Link href="/" className="truncate text-sm font-semibold md:hidden">
        {site_name}
      </Link>

      <div className="flex flex-1 justify-end md:justify-center">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={dictionary.search_input_label}
          className="border-input text-muted-foreground hover:bg-muted/50 focus-visible:ring-ring/50 flex size-8 items-center justify-center gap-2 rounded-md outline-none focus-visible:ring-3 md:h-8 md:w-full md:max-w-md md:justify-start md:border md:px-3"
        >
          <SearchIcon className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left text-sm md:inline">{dictionary.search_placeholder}</span>
          <kbd className="bg-muted hidden rounded px-1.5 py-0.5 font-sans text-[11px] md:inline">
            {dictionary.search_shortcut}
          </kbd>
        </button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label={dictionary.account_menu}>
            <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {initial}
            </span>
            <span className="hidden max-w-36 truncate text-sm lg:inline">{user.name || user.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
            <span className="truncate text-sm font-medium">{user.name || user.email}</span>
            {user.name && <span className="text-muted-foreground truncate text-xs">{user.email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LanguagesIcon />
              {dictionary.language}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={lang} onValueChange={onLanguageChange}>
                {language_options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} disabled={set_locale.isPending}>
                    <Image src={`/flags/${option.value}.svg`} alt="" width={18} height={12} className="rounded-[2px]" />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoonIcon />
              {dictionary.theme}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                {THEMES.map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {dictionary.themes[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem asChild>
            <Link href="/settings/profile">
              <UserIcon />
              {dictionary.profile}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`${SITE_URL}/${lang}`} target="_blank" rel="noopener">
              <ExternalLinkIcon />
              {dictionary.view_store}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut} disabled={sign_out.isPending}>
            <LogOutIcon />
            {dictionary.sign_out}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SearchDialog
        lang={lang}
        is_open={is_search_open}
        onOpenChange={setSearchOpen}
        dictionary={dictionary}
        errors={errors}
        close_label={close_label}
      />
    </header>
  );
}
