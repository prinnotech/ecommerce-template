import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SettingsSection } from "../../components/settings-section";
import { getAllSettings } from "@repo/core/actions/site-settings";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { buildOptions } from "../../options";
import { sectionForKey } from "../../sections";

export async function generateMetadata({ params }: PageProps<"/settings/[section]">): Promise<Metadata> {
  const { section } = await params;
  const dictionary = await getAdminDictionary(await getAdminLocale());
  const definition = sectionForKey(section);
  const label = definition ? dictionary.settings.sections[definition.key] : dictionary.settings.meta_title;
  return buildAdminMetadata(label);
}

export default async function SettingsSectionPage({ params }: PageProps<"/settings/[section]">) {
  const { section } = await params;
  const definition = sectionForKey(section);
  if (!definition) notFound();

  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.all_settings,
      queryFn: async () => unwrap(await getAllSettings()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <SettingsSection
        lang={lang}
        section_key={definition.key}
        can_edit={callerShows(caller, "settings.edit")}
        options={buildOptions(lang)}
        dictionary={dictionary.settings}
        errors={dictionary.errors}
        save_bar={dictionary.admin_ui.save_bar}
      />
    </HydrationBoundary>
  );
}
