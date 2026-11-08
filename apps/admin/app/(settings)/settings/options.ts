import { LOCALES } from "@repo/core/i18nConfig";
import { countryOptions } from "@repo/core/lib/locale/countries";

export type SelectOption = { value: string; label: string };

export type SettingOptions = {
  currencies: SelectOption[];
  timezones: SelectOption[];
  locales: SelectOption[];
  countries: SelectOption[];
};

// Built on the server so the browser's ICU data can't produce different lists (hydration mismatch).
export function buildOptions(lang: string): SettingOptions {
  const currency_names = new Intl.DisplayNames([lang], { type: "currency" });
  const language_names = new Intl.DisplayNames([lang], { type: "language" });
  return {
    currencies: Intl.supportedValuesOf("currency").map((code) => ({
      value: code,
      label: `${code} · ${currency_names.of(code) ?? code}`,
    })),
    timezones: Intl.supportedValuesOf("timeZone").map((zone) => ({ value: zone, label: zone.replace(/_/g, " ") })),
    locales: LOCALES.map((locale) => ({ value: locale, label: language_names.of(locale) ?? locale })),
    countries: countryOptions(lang).map((country) => ({ value: country.code, label: country.name })),
  };
}
