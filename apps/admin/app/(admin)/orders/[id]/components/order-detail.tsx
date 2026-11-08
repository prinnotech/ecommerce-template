"use client";

import { MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FulfillDialog } from "./fulfill-dialog";
import { OrderActions } from "./order-actions";
import { InternalNoteCard } from "./order-side-cards";
import { OrderTimeline } from "./order-timeline";
import { ORDER_TONE, PAYMENT_TONE } from "@/components/order-status-tone";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import { AddressBlock } from "@repo/core/components/address-block";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { useAdminOrder } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { OPEN_STATUSES } from "@repo/core/lib/orders";
import { formatCurrency, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { attributionSummary, type Attribution } from "@repo/core/lib/tracking/attribution";

type OrderDetailProps = {
  lang: string;
  order_id: string;
  can_edit: boolean;
  can_refund: boolean;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  order_status: AdminDictionary["order_status"];
  payment_status: AdminDictionary["payment_status"];
  // Payment method names by id.
  payment_method: Record<string, string>;
  refund_text: AdminDictionary["refund"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
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
  refund_text,
  common,
  errors,
}: OrderDetailProps) {
  const query = useAdminOrder(order_id);
  const [is_fulfill_open, setIsFulfillOpen] = useState(false);
  if (query.isPending) return <Skeleton className="h-[32rem] w-full" />;
  if (query.isError) return <p className="text-destructive text-sm">{errorText(errors, query.error)}</p>;

  const order = query.data;
  const money = (cents: number) => formatCurrency(cents, order.currency, lang);
  const is_billing_same = JSON.stringify(order.billing_address) === JSON.stringify(order.shipping_address);
  const method_label = payment_method[order.payment_method] ?? order.payment_method;
  const is_unfulfilled = OPEN_STATUSES.includes(order.status);
  const is_fulfilled = order.status === "shipped" || order.status === "delivered";

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
    <Page
      back={{ href: "/orders", label: dictionary.back }}
      title={`#${order.order_number}`}
      title_meta={
        <>
          <StatusBadge tone={PAYMENT_TONE[order.payment_status]}>{payment_status[order.payment_status]}</StatusBadge>
          <StatusBadge tone={ORDER_TONE[order.status]}>{order_status[order.status]}</StatusBadge>
        </>
      }
      subtitle={dictionary.placed.replace("{date}", formatDateTime(order.created_at, lang))}
      primary_action={
        can_edit ? (
          <OrderActions
            lang={lang}
            order={order}
            can_refund={can_refund}
            dictionary={dictionary}
            refund_text={refund_text}
            common={common}
            errors={errors}
          />
        ) : undefined
      }
    >
      <DetailLayout
        main={
          <>
            <SectionCard
              title={dictionary.items}
              action={
                <div className="flex items-center gap-2">
                  {is_unfulfilled && <StatusBadge tone="attention">{dictionary.unfulfilled}</StatusBadge>}
                  {is_fulfilled && <StatusBadge tone="success">{dictionary.fulfilled}</StatusBadge>}
                  {can_edit && (is_unfulfilled || is_fulfilled) && (
                    <Button
                      type="button"
                      size="sm"
                      variant={is_unfulfilled ? "default" : "outline"}
                      onClick={() => setIsFulfillOpen(true)}
                    >
                      {is_unfulfilled ? dictionary.fulfill : dictionary.edit_tracking}
                    </Button>
                  )}
                </div>
              }
              is_flush
              footer={
                is_fulfilled ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {order.tracking_number
                        ? `${dictionary.tracking}: ${[order.carrier, order.tracking_number].filter(Boolean).join(" · ")}`
                        : dictionary.no_tracking}
                    </span>
                    {order.tracking_url && (
                      <a href={order.tracking_url} target="_blank" rel="noreferrer" className="hover:underline">
                        {dictionary.tracking_number}
                      </a>
                    )}
                  </div>
                ) : undefined
              }
            >
              <ul className="divide-y">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <Thumbnail src={item.image} alt={item.title} size="md" />
                    <div className="min-w-0 flex-1">
                      {item.product ? (
                        <Link href={`/products/${item.product}`} className="text-sm font-medium hover:underline">
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
            </SectionCard>

            <SectionCard
              title={dictionary.payment}
              action={
                <StatusBadge tone={PAYMENT_TONE[order.payment_status]}>
                  {payment_status[order.payment_status]}
                </StatusBadge>
              }
            >
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{dictionary.payment}</span>
                  <span>{method_label}</span>
                </div>
                <dl className="flex flex-col gap-2">
                  {summary_rows.map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="tabular-nums">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <dt>{dictionary.total}</dt>
                  <dd className="tabular-nums">{money(order.total)}</dd>
                </div>
                {order.gift_card_total > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{dictionary.gift_card_paid}</dt>
                    <dd className="tabular-nums">{money(order.gift_card_total)}</dd>
                  </div>
                )}
                {(order.payment_status === "paid" || order.payment_status === "partially_refunded") && (
                  <div className="text-success-foreground flex justify-between">
                    <dt>{dictionary.paid_amount}</dt>
                    <dd className="tabular-nums">{money(order.total)}</dd>
                  </div>
                )}
                {(order.payment_status === "unpaid" || order.payment_status === "failed") && (
                  <div className="text-destructive flex justify-between font-medium">
                    <dt>{dictionary.balance_due}</dt>
                    <dd className="tabular-nums">{money(order.total - order.gift_card_total)}</dd>
                  </div>
                )}
                {order.payments.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-xs font-medium">{dictionary.payment_attempts}</span>
                    <ul className="flex flex-col gap-1">
                      {order.payments.map((payment) => (
                        <li key={payment.id} className="text-muted-foreground flex justify-between gap-2 text-xs">
                          <span>
                            {formatDateTime(payment.created_at, lang)} ·{" "}
                            {payment.provider in payment_method ? payment_method[payment.provider] : payment.provider}
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
              </div>
            </SectionCard>

            <SectionCard title={dictionary.timeline}>
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
            </SectionCard>
          </>
        }
        sidebar={
          <>
            <SectionCard title={dictionary.customer}>
              <div className="flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  {order.customer ? (
                    <Link href={`/customers/${order.customer.user_id}`} className="font-medium hover:underline">
                      {order.shipping_address?.full_name || order.email}
                    </Link>
                  ) : (
                    <span className="font-medium">{order.shipping_address?.full_name || order.email}</span>
                  )}
                  {order.customer ? (
                    <span className="text-muted-foreground">
                      {formatPlural(order.customer.order_count, dictionary.order_count, lang)}
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
              </div>
            </SectionCard>

            {order.customer_note && (
              <SectionCard title={dictionary.customer_note}>
                <p className="text-sm whitespace-pre-line">{order.customer_note}</p>
              </SectionCard>
            )}

            {order.refunds.length > 0 && <RefundsCard lang={lang} order={order} dictionary={refund_text} />}

            <SourceCard attribution={order.attribution} dictionary={dictionary} />

            <InternalNoteCard order={order} can_edit={can_edit} dictionary={dictionary} errors={errors} />
          </>
        }
      />

      <FulfillDialog
        order={order}
        is_open={is_fulfill_open}
        onOpenChange={setIsFulfillOpen}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
    </Page>
  );
}

// Where the customer came from (Settings → Tracking keeps the UTM and click ids on each order).
function SourceCard({
  attribution,
  dictionary,
}: {
  attribution: Attribution | null;
  dictionary: AdminDictionary["orders_admin"]["detail"];
}) {
  const summary = attributionSummary(attribution);
  const rows = [
    { label: dictionary.source, value: summary.source },
    { label: dictionary.medium, value: summary.medium },
    { label: dictionary.campaign, value: summary.campaign },
    { label: dictionary.landing_page, value: attribution?.landing_page ?? "" },
    { label: dictionary.referrer, value: attribution?.referrer ?? "" },
  ].filter((row) => row.value);
  return (
    <SectionCard title={dictionary.source_title}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{dictionary.source_direct}</p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate" title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  );
}

function RefundsCard({
  lang,
  order,
  dictionary,
}: {
  lang: string;
  order: AdminOrderDetail;
  dictionary: AdminDictionary["refund"];
}) {
  const money = (cents: number) => formatCurrency(cents, order.currency, lang);
  return (
    <SectionCard title={dictionary.history}>
      <p className="text-sm">
        {dictionary.refunded_total}: <span className="font-semibold tabular-nums">{money(order.refunded_total)}</span>
      </p>
      <ul className="divide-y text-sm">
        {order.refunds.map((refund) => (
          <li key={refund.id} className="flex flex-col gap-0.5 py-2">
            <span className="flex justify-between gap-2">
              <span className="tabular-nums">{money(refund.amount)}</span>
              <span className="text-muted-foreground text-xs">{formatDateTime(refund.created_at, lang)}</span>
            </span>
            {refund.lines.length > 0 && (
              <span className="text-muted-foreground text-xs">
                {refund.lines
                  .map((line) => {
                    const item = order.items.find((candidate) => candidate.id === line.item_id);
                    return `${line.quantity} × ${item?.title ?? "—"}`;
                  })
                  .join(", ")}
                {refund.restocked && ` · ${dictionary.restocked}`}
              </span>
            )}
            {(refund.reason || refund.actor_name) && (
              <span className="text-muted-foreground text-xs">
                {[refund.reason, refund.actor_name].filter(Boolean).join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
