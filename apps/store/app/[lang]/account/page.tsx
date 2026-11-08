import type { Metadata } from "next";
import Link from "next/link";

import { OrderList } from "./components/order-list";
import { getMyAddresses, getMyOrders } from "@repo/core/actions/account";
import { AddressBlock } from "@repo/core/components/address-block";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/account", title: dictionary.account.meta_title, is_private: true });
}

export default async function AccountOverviewPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  const [dictionary, orders, addresses, currency] = await Promise.all([
    getDictionary(lang),
    getMyOrders(3),
    getMyAddresses(),
    getSiteSetting("CURRENCY"),
  ]);
  const text = dictionary.account.overview;
  const default_address = addresses.ok ? addresses.data.find((address) => address.is_default) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{text.recent_orders}</CardTitle>
          {orders.ok && orders.data.length > 0 && (
            <Link href={`/${lang}/account/orders`} className="text-sm font-medium underline-offset-4 hover:underline">
              {text.view_all}
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {!orders.ok ? (
            <p className="text-destructive text-sm">{dictionary.errors[orders.error]}</p>
          ) : orders.data.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-sm">{text.no_orders}</p>
              <Button asChild variant="outline">
                <Link href={`/${lang}`}>{text.start_shopping}</Link>
              </Button>
            </div>
          ) : (
            <OrderList
              lang={lang}
              orders={orders.data}
              default_currency={currency}
              dictionary={dictionary.account.orders}
              order_status={dictionary.order_status}
              payment_status={dictionary.payment_status}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{text.default_address}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          {default_address ? (
            <AddressBlock address={default_address} lang={lang} />
          ) : (
            <p className="text-muted-foreground text-sm">{text.no_address}</p>
          )}
          <Link href={`/${lang}/account/addresses`} className="text-sm font-medium underline-offset-4 hover:underline">
            {text.manage_addresses}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
