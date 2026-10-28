import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderDetail } from "./components/order-detail";
import { getAdminOrder } from "@/app/actions/orders";
import { callerCan, requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/orders/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: `/dashboard/orders/${id}`,
    title: dictionary.orders_admin.meta_title,
    is_private: true,
  });
}

export default async function DashboardOrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang, id } = await params;
  const caller = await requirePermission(lang, "orders.view");
  const order = await getAdminOrder(id);
  if (!order.ok) notFound();

  const query_client = new QueryClient();
  query_client.setQueryData(query_keys.admin_order(id), order.data);
  const dictionary = await getDictionary(lang);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <OrderDetail
        lang={lang}
        order_id={id}
        can_edit={callerCan(caller, "orders.edit")}
        can_refund={callerCan(caller, "orders.refund")}
        dictionary={dictionary.orders_admin.detail}
        order_status={dictionary.order_status}
        payment_status={dictionary.payment_status}
        payment_method={dictionary.payment_method}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
