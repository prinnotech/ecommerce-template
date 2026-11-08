"use client";

import { LanguagesIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { useSetAdminLocale } from "@repo/core/hooks/use-admin";
import type { Locale } from "@repo/core/i18nConfig";

type LanguageSelectProps = {
  lang: Locale;
  label: string;
  options: { value: Locale; label: string }[];
};

// Sign-in pages: staff can pick the admin language before signing in (same cookie as the profile menu).
export function LanguageSelect({ lang, label, options }: LanguageSelectProps) {
  const router = useRouter();
  const set_locale = useSetAdminLocale();

  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <LanguagesIcon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <NativeSelect
        value={lang}
        disabled={set_locale.isPending}
        onChange={(event) =>
          set_locale.mutate({ locale: event.target.value as Locale }, { onSuccess: () => router.refresh() })
        }
        className="h-8 text-sm"
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}
