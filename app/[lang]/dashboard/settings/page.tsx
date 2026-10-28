import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { SettingsScreen, type SettingOptions } from "./components/settings-screen";
import { getAllSettings } from "@/app/actions/site-settings";
import { LOCALES } from "@/i18nConfig";
import { unwrap } from "@/lib/action-result";
import { callerCan, requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { countryOptions } from "@/lib/locale/countries";
import { query_keys } from "@/lib/query-keys";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/settings">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/settings",
    title: dictionary.settings.meta_title,
    is_private: true,
  });
}

// Built on the server so the browser's ICU data can't produce different lists (hydration mismatch).
function buildOptions(lang: string): SettingOptions {
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

export default async function DashboardSettingsPage({ params }: PageProps<"/[lang]/dashboard/settings">) {
  const { lang } = await params;
  const caller = await requirePermission(lang, "settings.view");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.all_settings,
      queryFn: async () => unwrap(await getAllSettings()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <SettingsScreen
        lang={lang}
        can_edit={callerCan(caller, "settings.edit")}
        options={buildOptions(lang)}
        dictionary={dictionary.settings}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
