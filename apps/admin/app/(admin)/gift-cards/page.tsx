import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { GiftCardsScreen } from "./components/gift-cards-screen";
import { getGiftCards } from "@repo/core/actions/gift-cards";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { gift_card_filters_schema } from "@repo/core/lib/schemas/gift-cards";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.gift_cards.title);
}

export default async function GiftCardsPage({ searchParams }: PageProps<"/gift-cards">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("gift_cards.view");
  const filters = gift_card_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, settings, cards] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSettings(),
    getGiftCards(filters),
  ]);
  if (cards.ok) query_client.setQueryData(query_keys.gift_cards(filters), cards.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <GiftCardsScreen
          lang={lang}
          currency={settings.CURRENCY}
          time_zone={settings.TIMEZONE}
          can_edit={callerShows(caller, "gift_cards.edit")}
          dictionary={dictionary.gift_cards}
          index_table={dictionary.admin_ui.index_table}
          common={dictionary.common}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
