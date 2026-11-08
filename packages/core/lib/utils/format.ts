// Intl formatting. Always pass the current `lang`. Money is integer cents.

export function formatCurrency(amount_cents: number, currency: string, lang: string): string {
  return new Intl.NumberFormat(lang, { style: "currency", currency }).format(amount_cents / 100);
}

export function formatNumber(value: number, lang: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang, options).format(value);
}

export function formatDate(value: string | Date, lang: string, time_zone?: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: time_zone }).format(new Date(value));
}

export function formatDateTime(value: string | Date, lang: string, time_zone?: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: time_zone }).format(
    new Date(value),
  );
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

export function formatRelativeTime(value: string | Date, lang: string, now: Date = new Date()): string {
  const seconds = (new Date(value).getTime() - now.getTime()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  for (const [unit, unit_seconds] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= unit_seconds || unit === "second") {
      return formatter.format(Math.round(seconds / unit_seconds), unit);
    }
  }
  return formatter.format(0, "second");
}

// Dictionary text that depends on a count: { one: "{count} item", other: "{count} items" }.
export type PluralText = { one: string; other: string };

// Picks the form with Intl.PluralRules ("1 articolo", "2 articoli") and fills in {count}.
// Italian and Spanish also have a "many" category (for millions); it uses the "other" text.
export function formatPlural(count: number, text: PluralText, lang: string): string {
  const form = new Intl.PluralRules(lang).select(count) === "one" ? text.one : text.other;
  return form.replace("{count}", formatNumber(count, lang));
}
