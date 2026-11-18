import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TranslationEditor } from "./components/translation-editor";
import { getLanguageTexts } from "@repo/core/actions/languages";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { languageName, storeLocales } from "@repo/core/lib/languages";
import { query_keys } from "@repo/core/lib/query-keys";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/settings/languages/[code]">): Promise<Metadata> {
  const [{ code }, lang] = await Promise.all([params, getAdminLocale()]);
  const dictionary = await getAdminDictionary(lang);
  return buildAdminMetadata(`${languageName(code, lang)} · ${dictionary.languages.title}`);
}

export default async function LanguageEditorPage({ params }: PageProps<"/settings/languages/[code]">) {
  const { code } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [languages, default_locale] = await Promise.all([
    getSiteSetting("LANGUAGES"),
    getSiteSetting("DEFAULT_LOCALE"),
  ]);
  if (!storeLocales(languages).includes(code)) notFound();
  const [dictionary, texts] = await Promise.all([getAdminDictionary(lang), getLanguageTexts({ locale: code })]);
  const query_client = new QueryClient();
  if (texts.ok) query_client.setQueryData(query_keys.language_texts(code), texts.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <TranslationEditor
        locale={code}
        default_locale={default_locale}
        language_name={languageName(code, lang)}
        lang={lang}
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        dictionary={dictionary.languages}
        save_bar={dictionary.admin_ui.save_bar}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
