import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { ThemeButton } from "@repo/core/lib/schemas/theme";

// Theme links are stored without the language ("/shop?sort=newest") so one theme serves every
// locale; external links are kept as they are.
export function sectionHref(href: string, lang: string): string {
  return href.startsWith("/") ? `/${lang}${href === "/" ? "" : href}` : href;
}

// A button shows only when it has both a label (in some language) and a link.
export function sectionButton(button: ThemeButton, lang: string): { label: string; href: string } | null {
  const label = localized(button.label, lang as Locale);
  if (!label || !button.href) return null;
  return { label, href: sectionHref(button.href, lang) };
}
