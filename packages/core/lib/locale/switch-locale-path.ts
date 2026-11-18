import { isLocale, type Locale } from "@repo/core/i18nConfig";

// "/es/shop/linen-shirt?x=1" → "/it/shop/linen-shirt?x=1". Store paths always start with a
// language, so a first segment shaped like a language code is the current one.
export function switchLocalePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  if (isLocale(segments[1] ?? "")) segments[1] = locale;
  else segments.splice(1, 0, locale);
  return segments.join("/") || `/${locale}`;
}
