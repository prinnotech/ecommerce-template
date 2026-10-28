"use client";

import { ArrowLeftIcon, MailIcon, PhoneIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { OrderActions } from "./order-actions";
import { InternalNoteCard, TrackingCard } from "./order-side-cards";
import { OrderTimeline } from "./order-timeline";
import { AddressBlock } from "@/components/address-block";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOrder } from "@/hooks/use-orders";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type OrderDetailProps = {
  lang: string;
  order_id: string;
  can_edit: boolean;
  can_refund: boolean;
  dictionary: Dictionary["orders_admin"]["detail"];
  order_status: Dictionary["order_status"];
  payment_status: Dictionary["payment_status"];
  payment_method: Dictionary["payment_method"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

export function OrderDetail({
  lang,
  order_id,
  can_edit,
  can_refund,
  dictionary,
  order_status,
  payment_status,
  payment_method,
  common,
  errors,
}: OrderDetailProps) {
  const query = useAdminOrder(order_id);
  if (query.isPending) return <Skeleton className="h-[32rem] w-full" />;
  if (query.isError) return <p className="text-destructive text-sm">{errorText(errors, query.error)}</p>;

  const order = query.data;
  const money = (cents: number) => formatCurrency(cents, order.currency, lang);
  const card_props = { order, can_edit, dictionary, common, errors };
  const is_billing_same = JSON.stringify(order.billing_address) === JSON.stringify(order.shipping_address);
  const method_label =
    order.payment_method in payment_method
      ? payment_method[order.payment_method as keyof Dictionary["payment_method"]]
      : order.payment_method;

  const summary_rows = [
    { label: dictionary.subtotal, value: money(order.subtotal), is_shown: true },
    {
      label: order.discount_code ? `${dictionary.discount} (${order.discount_code})` : dictionary.discount,
      value: `−${money(order.discount_total)}`,
      is_shown: order.discount_total > 0,
    },
    { label: dictionary.shipping, value: money(order.shipping_total), is_shown: true },
    { label: dictionary.cod_fee, value: money(order.cod_fee), is_shown: order.cod_fee > 0 },
    { label: dictionary.taxes, value: money(order.tax_total), is_shown: order.tax_total > 0 },
  ].filter((row) => row.is_shown);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href={`/${lang}/dashboard/orders`}
            className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {dictionary.back}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">#{order.order_number}</h1>
            <PaymentStatusBadge status={order.payment_status} label={payment_status[order.payment_status]} />
            <OrderStatusBadge status={order.status} label={order_status[order.status]} />
          </div>
          <p className="text-muted-foreground text-sm">
            {dictionary.placed.replace("{date}", formatDateTime(order.created_at, lang))}
          </p>
        </div>
        {can_edit && (
          <OrderActions
            lang={lang}
            order={order}
            can_refund={can_refund}
            dictionary={dictionary}
            common={common}
            errors={errors}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{dictionary.items}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0">
                    <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md border">
                      {item.image && (
                        <Image src={item.image} alt="" fill sizes="48px" unoptimized className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.product ? (
                        <Link
                          href={`/${lang}/dashboard/products/${item.product}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">{item.title}</p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {[item.variant_label, item.sku && dictionary.sku.replace("{sku}", item.sku)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm tabular-nums">
                      {money(item.unit_price)} × {item.quantity}
                    </p>
                    <p className="w-24 text-right text-sm font-medium tabular-nums">{money(item.line_total)}</p>
                  </li>
                ))}
              </ul>
              <Separator className="my-4" />
              <dl className="flex flex-col gap-2 text-sm">
                {summary_rows.map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="tabular-nums">{row.value}</dd>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-base font-semibold">
                  <dt>{dictionary.total}</dt>
                  <dd className="tabular-nums">{money(order.total)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dictionary.timeline}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline
                lang={lang}
                order={order}
                can_edit={can_edit}
                dictionary={dictionary}
                order_status={order_status}
                payment_status={payment_status}
                common={common}
                errors={errors}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{dictionary.customer}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{order.shipping_address?.full_name || order.email}</span>
                {order.customer ? (
                  <span className="text-muted-foreground">
                    {dictionary.order_count.replace("{count}", String(order.customer.order_count))}
                  </span>
                ) : (
                  <Badge variant="outline" className="w-fit">
                    {dictionary.guest}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">{dictionary.contact}</span>
                <a
                  href={`mailto:${order.email}`}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                  <MailIcon className="size-3.5" aria-hidden />
                  {order.email}
                </a>
                {order.phone && (
                  <a
                    href={`tel:${order.phone.replace(/\s+/g, "")}`}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <PhoneIcon className="size-3.5" aria-hidden />
                    {order.phone}
                  </a>
                )}
              </div>
              {order.shipping_address && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-medium">{dictionary.shipping_address}</span>
                  <AddressBlock address={order.shipping_address} lang={lang} />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">{dictionary.billing_address}</span>
                {is_billing_same || !order.billing_address ? (
                  <span className="text-muted-foreground">{dictionary.same_as_shipping}</span>
                ) : (
                  <AddressBlock address={order.billing_address} lang={lang} />
                )}
              </div>
            </CardContent>
          </Card>

          {order.customer_note && (
            <Card>
              <CardHeader>
                <CardTitle>{dictionary.customer_note}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{order.customer_note}</CardContent>
            </Card>
          )}

          <TrackingCard key={`${order.carrier}|${order.tracking_number}|${order.tracking_url}`} {...card_props} />

          <Card>
            <CardHeader>
              <CardTitle>{dictionary.payment}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{method_label}</span>
                <PaymentStatusBadge status={order.payment_status} label={payment_status[order.payment_status]} />
              </div>
              {order.payments.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium">{dictionary.payment_attempts}</span>
                  <ul className="flex flex-col gap-1">
                    {order.payments.map((payment) => (
                      <li key={payment.id} className="text-muted-foreground flex justify-between gap-2 text-xs">
                        <span>
                          {formatDateTime(payment.created_at, lang)} ·{" "}
                          {payment.provider in payment_method
                            ? payment_method[payment.provider as keyof Dictionary["payment_method"]]
                            : payment.provider}
                        </span>
                        <span className={payment.status === "failed" ? "text-destructive" : undefined}>
                          {dictionary.payment_record[payment.status]}
                          {payment.error_code && ` (${payment.error_code})`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <InternalNoteCard key={order.internal_note} {...card_props} />
        </div>
      </div>
    </div>
  );
}
