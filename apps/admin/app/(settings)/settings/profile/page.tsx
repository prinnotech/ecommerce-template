import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { ProfileScreen } from "./components/profile-screen";
import { getMyProfile } from "@repo/core/actions/account";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { languageOptions } from "@repo/core/lib/locale/language-options";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.profile.meta_title);
}

export default async function ProfilePage() {
  const lang = await getAdminLocale();
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.my_profile,
      queryFn: async () => unwrap(await getMyProfile()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <ProfileScreen
        lang={lang}
        language_options={languageOptions()}
        dictionary={dictionary.profile}
        password_input={dictionary.auth.password_input}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
