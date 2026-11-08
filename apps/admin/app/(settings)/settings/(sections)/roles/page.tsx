import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { RolesScreen } from "./components/roles-screen";
import { getRoles } from "@repo/core/actions/roles";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.roles.meta_title);
}

export default async function RolesPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("roles.view");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.roles,
      queryFn: async () => unwrap(await getRoles()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <RolesScreen
        can_edit={callerShows(caller, "roles.edit")}
        is_admin={caller.is_admin}
        dictionary={dictionary.roles}
        permissions_dictionary={dictionary.permissions}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
