import { LOCALES, type Locale } from "@repo/core/i18nConfig";

// "/es/shop/linen-shirt?x=1" → "/it/shop/linen-shirt?x=1"
export function switchLocalePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  if ((LOCALES as readonly string[]).includes(segments[1] ?? "")) segments[1] = locale;
  else segments.splice(1, 0, locale);
  return segments.join("/") || `/${locale}`;
}
