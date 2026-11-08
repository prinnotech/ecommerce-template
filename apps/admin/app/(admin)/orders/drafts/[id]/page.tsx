import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DraftEditor } from "./components/draft-editor";
import { getDraftOrder } from "@repo/core/actions/draft-orders";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { COUNTRY_CODES, countryOptions } from "@repo/core/lib/locale/countries";
import { query_keys } from "@repo/core/lib/query-keys";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.draft_orders.title);
}

export default async function DraftOrderPage({ params }: PageProps<"/orders/drafts/[id]">) {
  const { id } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("draft_orders.view");
  const view = await getDraftOrder(id);
  if (!view.ok) notFound();

  const query_client = new QueryClient();
  query_client.setQueryData(query_keys.draft_order(id), view.data);
  const [dictionary, store_address] = await Promise.all([getAdminDictionary(lang), getSiteSetting("STORE_ADDRESS")]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <DraftEditor
        lang={lang}
        draft_id={id}
        can_edit={callerShows(caller, "draft_orders.edit")}
        store_country={COUNTRY_CODES.find((code) => code === store_address.country) ?? ""}
        countries={countryOptions(lang).map((country) => ({ value: country.code, label: country.name }))}
        dictionary={dictionary.draft_orders}
        checkout={dictionary.checkout}
        common={dictionary.common}
        confirm={dictionary.admin_ui.confirm}
        save_bar={dictionary.admin_ui.save_bar}
        validation={dictionary.validation}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
