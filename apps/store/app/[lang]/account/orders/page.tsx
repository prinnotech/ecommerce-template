import type { Metadata } from "next";
import Link from "next/link";

import { OrderList } from "../components/order-list";
import { getMyOrders } from "@repo/core/actions/account";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/orders">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/account/orders",
    title: dictionary.account.orders.title,
    is_private: true,
  });
}

export default async function AccountOrdersPage({ params }: PageProps<"/[lang]/account/orders">) {
  const { lang } = await params;
  const [dictionary, orders, currency] = await Promise.all([
    getDictionary(lang),
    getMyOrders(),
    getSiteSetting("CURRENCY"),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.account.orders.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!orders.ok ? (
          <p className="text-destructive text-sm">{dictionary.errors[orders.error]}</p>
        ) : orders.data.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">{dictionary.account.orders.empty}</p>
            <Button asChild variant="outline">
              <Link href={`/${lang}`}>{dictionary.account.overview.start_shopping}</Link>
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
  );
}
