import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PaymentsScreen } from "./components/payments-screen";
import { getPaymentsOverview } from "@repo/core/actions/payments";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.payments.title);
}

export default async function PaymentsPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, overview, currency] = await Promise.all([
    getAdminDictionary(lang),
    getPaymentsOverview(),
    getSiteSetting("CURRENCY"),
  ]);
  const query_client = new QueryClient();
  if (overview.ok) query_client.setQueryData(query_keys.payments, overview.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <PaymentsScreen
        lang={lang}
        currency={currency}
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        dictionary={dictionary.payments}
        common={dictionary.common}
        errors={dictionary.errors}
        save_bar={dictionary.admin_ui.save_bar}
      />
    </HydrationBoundary>
  );
}
