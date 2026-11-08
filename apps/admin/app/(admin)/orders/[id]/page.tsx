import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderDetail } from "./components/order-detail";
import { getAdminOrder } from "@repo/core/actions/orders";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { localized } from "@repo/core/lib/localized";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.orders_admin.meta_title);
}

export default async function DashboardOrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("orders.view");
  const order = await getAdminOrder(id);
  if (!order.ok) notFound();

  const query_client = new QueryClient();
  query_client.setQueryData(query_keys.admin_order(id), order.data);
  const [dictionary, methods] = await Promise.all([getAdminDictionary(lang), getSiteSetting("PAYMENT_METHODS")]);
  // Method names by id (manual methods have their own); old orders may still say "card".
  const payment_method_names: Record<string, string> = {
    ...dictionary.payment_method,
    stripe: dictionary.payment_method.card,
    ...Object.fromEntries(methods.map((method) => [method.id, localized(method.name, lang) || method.id])),
  };

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <OrderDetail
        lang={lang}
        order_id={id}
        can_edit={callerShows(caller, "orders.edit")}
        can_refund={callerShows(caller, "orders.refund")}
        dictionary={dictionary.orders_admin.detail}
        order_status={dictionary.order_status}
        payment_status={dictionary.payment_status}
        payment_method={payment_method_names}
        refund_text={dictionary.refund}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
