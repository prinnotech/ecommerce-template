import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { StaffScreen } from "./components/staff-screen";
import { getRoles } from "@repo/core/actions/roles";
import { getTeamMembers } from "@repo/core/actions/team";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.staff.meta_title);
}

export default async function StaffPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("users.view");
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.team_members,
      queryFn: async () => unwrap(await getTeamMembers()),
    }),
    query_client.prefetchQuery({
      queryKey: query_keys.roles,
      queryFn: async () => unwrap(await getRoles()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <StaffScreen
        can_invite={callerShows(caller, "users.invite")}
        can_edit={callerShows(caller, "users.edit")}
        can_deactivate={callerShows(caller, "users.deactivate")}
        is_admin={caller.is_admin}
        current_user_id={caller.user_id}
        dictionary={dictionary.staff}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
