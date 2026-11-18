import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { languageName } from "@repo/core/lib/languages";

// Each language in its own name ("English", "Español", "Italiano"), so visitors find theirs
// whatever language the page is in. The admin offers the shipped languages (the default); the
// store passes its published ones.
export function languageOptions(locales: readonly Locale[] = LOCALES): { value: Locale; label: string }[] {
  return locales.map((value) => ({ value, label: languageName(value) }));
}
