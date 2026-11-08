import { LOCALES, type Locale } from "@repo/core/i18nConfig";

// Each language in its own name ("English", "Español", "Italiano"), so visitors find theirs
// whatever language the page is in.
export function languageOptions(): { value: Locale; label: string }[] {
  return LOCALES.map((value) => {
    const name = new Intl.DisplayNames([value], { type: "language" }).of(value) ?? value;
    return { value, label: name.charAt(0).toLocaleUpperCase(value) + name.slice(1) };
  });
}
