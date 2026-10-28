"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { LOCALE_COOKIE, type Locale } from "@/i18nConfig";
import { switchLocalePath } from "@/lib/locale/switch-locale-path";

type LanguageSwitcherProps = {
  lang: string;
  label: string;
  options: { value: Locale; label: string }[];
};

export function LanguageSwitcher({ lang, label, options }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();

  function onChange(locale: Locale) {
    // Remember the choice so the proxy doesn't switch back on the next visit.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const query = search_params.toString();
    router.push(`${switchLocalePath(pathname, locale)}${query ? `?${query}` : ""}`);
  }

  return (
    <NativeSelect
      aria-label={label}
      value={lang}
      onChange={(event) => onChange(event.target.value as Locale)}
      size="sm"
    >
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
