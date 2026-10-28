import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { AddressBook } from "./components/address-book";
import { getMyAddresses } from "@/app/actions/account";
import { unwrap } from "@/lib/action-result";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/addresses">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/account/addresses",
    title: dictionary.account.addresses.title,
    is_private: true,
  });
}

export default async function AccountAddressesPage({ params }: PageProps<"/[lang]/account/addresses">) {
  const { lang } = await params;
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.my_addresses,
      queryFn: async () => unwrap(await getMyAddresses()),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <AddressBook
        lang={lang}
        dictionary={dictionary.account.addresses}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
