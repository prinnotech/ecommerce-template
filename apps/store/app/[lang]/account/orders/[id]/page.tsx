import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getMyOrder, type OrderDetail } from "@repo/core/actions/account";
import { AddressBlock } from "@repo/core/components/address-block";
import { OrderStatusBadge, PaymentStatusBadge } from "@repo/core/components/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary, type Dictionary } from "@repo/core/lib/i18n";
import type { OrderStatus } from "@repo/core/lib/orders";
import { address_fields_schema } from "@repo/core/lib/schemas/account";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { paymentMethodName } from "@repo/core/lib/payment-methods";
import type { Locale } from "@repo/core/i18nConfig";
import { formatCurrency, formatDate, formatDateTime } from "@repo/core/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/orders/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: `/account/orders/${id}`,
    title: dictionary.account.orders.order,
    is_private: true,
  });
}

function isOrderStatus(value: string, labels: Dictionary["order_status"]): value is OrderStatus {
  return value in labels;
}

function eventLabel(event: OrderDetail["events"][number], dictionary: Dictionary): string {
  const template = dictionary.order_event[event.type];
  const status = event.to_status;
  if (!status) return template;
  const status_label = isOrderStatus(status, dictionary.order_status)
    ? dictionary.order_status[status]
    : status in dictionary.payment_status
      ? dictionary.payment_status[status as keyof Dictionary["payment_status"]]
      : status;
  return template.replace("{status}", status_label.toLowerCase());
}

export default async function AccountOrderPage({ params }: PageProps<"/[lang]/account/orders/[id]">) {
  const { lang, id } = await params;
  const [dictionary, result, settings] = await Promise.all([getDictionary(lang), getMyOrder(id), getSiteSettings()]);
  const default_currency = settings.CURRENCY;
  if (!result.ok) notFound();

  const order = result.data;
  const text = dictionary.account.orders;
  const money = (cents: number) => formatCurrency(cents, order.currency || default_currency, lang);
  const shipping_address = address_fields_schema.safeParse(order.shipping_address);
  const billing_address = address_fields_schema.safeParse(order.billing_address);

  const summary_rows = [
    { label: text.subtotal, value: order.subtotal, is_shown: true },
    { label: text.discount, value: -order.discount_total, is_shown: order.discount_total > 0 },
    { label: text.shipping, value: order.shipping_total, is_shown: true },
    { label: text.cod_fee, value: order.cod_fee, is_shown: order.cod_fee > 0 },
    { label: text.tax, value: order.tax_total, is_shown: order.tax_total > 0 },
  ].filter((row) => row.is_shown);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/${lang}/account/orders`}
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          {text.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{text.order_number.replace("{number}", String(order.order_number))}</h2>
          <OrderStatusBadge status={order.status} label={dictionary.order_status[order.status]} />
          <PaymentStatusBadge status={order.payment_status} label={dictionary.payment_status[order.payment_status]} />
        </div>
        <p className="text-muted-foreground text-sm">
          {text.placed_on.replace("{date}", formatDate(order.created_at, lang))}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{text.items}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{item.title}</span>
                      {item.variant_label && (
                        <span className="text-muted-foreground text-sm">{item.variant_label}</span>
                      )}
                      <span className="text-muted-foreground text-sm">
                        {text.quantity.replace("{quantity}", String(item.quantity))} × {money(item.unit_price)}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{money(item.line_total)}</span>
                  </li>
                ))}
              </ul>
              <Separator className="my-3" />
              <dl className="flex flex-col gap-1.5 text-sm">
                {summary_rows.map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="tabular-nums">{money(row.value)}</dd>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 text-base font-semibold">
                  <dt>{text.total}</dt>
                  <dd className="tabular-nums">{money(order.total)}</dd>
                </div>
                {order.gift_card_total > 0 && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{dictionary.checkout.gift_card}</dt>
                      <dd className="tabular-nums">−{money(order.gift_card_total)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <dt>{dictionary.checkout.to_pay}</dt>
                      <dd className="tabular-nums">{money(Math.max(0, order.total - order.gift_card_total))}</dd>
                    </div>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          {order.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{text.timeline}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-4 border-l pl-4">
                  {order.events.map((event) => (
                    <li key={event.id} className="relative flex flex-col gap-0.5">
                      <span className="bg-foreground absolute top-1.5 -left-[21px] size-2 rounded-full" aria-hidden />
                      <span className="text-sm font-medium">{eventLabel(event, dictionary)}</span>
                      {event.message && <span className="text-muted-foreground text-sm">{event.message}</span>}
                      <time className="text-muted-foreground text-xs" dateTime={event.created_at}>
                        {formatDateTime(event.created_at, lang)}
                      </time>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {shipping_address.success && (
            <Card>
              <CardHeader>
                <CardTitle>{text.shipping_address}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <AddressBlock address={shipping_address.data} lang={lang} />
                {order.shipping_method && (
                  <p className="text-muted-foreground text-sm">
                    {text.shipping_method}: {order.shipping_method}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {billing_address.success && (
            <Card>
              <CardHeader>
                <CardTitle>{text.billing_address}</CardTitle>
              </CardHeader>
              <CardContent>
                <AddressBlock address={billing_address.data} lang={lang} />
              </CardContent>
            </Card>
          )}
          {order.payment_method && (
            <Card>
              <CardHeader>
                <CardTitle>{text.payment_method}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {paymentMethodName(settings, order.payment_method, lang as Locale, dictionary.payment_method)}
              </CardContent>
            </Card>
          )}
          {(order.tracking_number || order.tracking_url) && (
            <Card>
              <CardHeader>
                <CardTitle>{text.tracking}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <span>{[order.carrier, order.tracking_number].filter(Boolean).join(" · ")}</span>
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-fit items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    {text.track_package}
                    <ExternalLinkIcon className="size-3.5" aria-hidden />
                  </a>
                )}
              </CardContent>
            </Card>
          )}
          {order.customer_note && (
            <Card>
              <CardHeader>
                <CardTitle>{text.customer_note}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{order.customer_note}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
