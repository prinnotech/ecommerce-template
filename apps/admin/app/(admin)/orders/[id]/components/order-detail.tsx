"use client";

import { MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { FulfillDialog } from "./fulfill-dialog";
import { TrackingDialog, type TrackingTarget } from "./tracking-dialog";
import { OrderActions } from "./order-actions";
import { InternalNoteCard } from "./order-side-cards";
import { OrderTimeline } from "./order-timeline";
import { ORDER_TONE, PAYMENT_TONE } from "@/components/order-status-tone";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import { discountLines } from "@repo/core/lib/checkout/pricing";
import { AddressBlock } from "@repo/core/components/address-block";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { useAdminOrder, useCancelFulfillment } from "@repo/core/hooks/use-orders";
import { unfulfilledQuantities } from "@repo/core/lib/fulfillment";
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
  const [tracking_target, setTrackingTarget] = useState<TrackingTarget | null>(null);
  const [cancel_package_id, setCancelPackageId] = useState<string | null>(null);
  const cancel_package = useCancelFulfillment();
  if (query.isPending) return <Skeleton className="h-[32rem] w-full" />;
  if (query.isError) return <p className="text-destructive text-sm">{errorText(errors, query.error)}</p>;

  const order = query.data;
  const money = (cents: number) => formatCurrency(cents, order.currency, lang);
  const is_billing_same = JSON.stringify(order.billing_address) === JSON.stringify(order.shipping_address);
  const method_label = payment_method[order.payment_method] ?? order.payment_method;
  const is_unfulfilled = OPEN_STATUSES.includes(order.status);
  const is_fulfilled = order.status === "shipped" || order.status === "delivered";
  // Packages that weren't cancelled, and what is still to ship. Orders closed without any package
  // (shipped before packages existed, or cancelled) keep the single items card.
  const packages = order.fulfillments.filter((fulfillment) => fulfillment.status === "shipped");
  const left = unfulfilledQuantities(order.items, order.fulfillments);
  const left_count = [...left.values()].reduce((sum, quantity) => sum + quantity, 0);
  const is_legacy = packages.length === 0 && !is_unfulfilled;

  const summary_rows = [
    { label: dictionary.subtotal, value: money(order.subtotal), is_shown: true },
    // One line per discount; older orders only know their code.
    ...discountLines(order).map((line) => {
      const name = line.label || order.discount_code;
      return {
        label: name ? `${dictionary.discount} (${name})` : dictionary.discount,
        value: `−${money(line.amount)}`,
        is_shown: true,
      };
    }),
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
            {is_legacy ? (
              <SectionCard
                title={dictionary.items}
                action={
                  <div className="flex items-center gap-2">
                    {is_fulfilled && <StatusBadge tone="success">{dictionary.fulfilled}</StatusBadge>}
                    {can_edit && is_fulfilled && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setTrackingTarget({ kind: "order" })}
                      >
                        {dictionary.edit_tracking}
                      </Button>
                    )}
                  </div>
                }
                is_flush
                footer={is_fulfilled ? <TrackingLine tracking={order} dictionary={dictionary} /> : undefined}
              >
                <ul className="divide-y">
                  {order.items.map((item) => (
                    <ItemRow key={item.id} item={item} quantity={item.quantity} money={money} dictionary={dictionary} />
                  ))}
                </ul>
              </SectionCard>
            ) : (
              <>
                {left_count > 0 && (
                  <SectionCard
                    title={dictionary.unfulfilled}
                    action={
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="attention">
                          {formatPlural(left_count, dictionary.items_count, lang)}
                        </StatusBadge>
                        {can_edit && is_unfulfilled && (
                          <Button type="button" size="sm" onClick={() => setIsFulfillOpen(true)}>
                            {dictionary.fulfill}
                          </Button>
                        )}
                      </div>
                    }
                    is_flush
                  >
                    <ul className="divide-y">
                      {order.items
                        .filter((item) => (left.get(item.id) ?? 0) > 0)
                        .map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            quantity={left.get(item.id) ?? 0}
                            money={money}
                            dictionary={dictionary}
                          />
                        ))}
                    </ul>
                  </SectionCard>
                )}
                {packages.map((fulfillment, index) => (
                  <SectionCard
                    key={fulfillment.id}
                    title={dictionary.package_title.replace("{number}", String(index + 1))}
                    description={[
                      formatDateTime(fulfillment.created_at, lang),
                      fulfillment.actor_name && dictionary.by.replace("{name}", fulfillment.actor_name),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    action={<StatusBadge tone="success">{dictionary.fulfilled}</StatusBadge>}
                    is_flush
                    footer={
                      <TrackingLine tracking={fulfillment} dictionary={dictionary}>
                        {can_edit && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setTrackingTarget({
                                kind: "package",
                                fulfillment_id: fulfillment.id,
                                tracking: fulfillment,
                              })
                            }
                          >
                            {dictionary.edit_tracking}
                          </Button>
                        )}
                        {can_edit && is_unfulfilled && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setCancelPackageId(fulfillment.id)}
                          >
                            {dictionary.cancel_package}
                          </Button>
                        )}
                      </TrackingLine>
                    }
                  >
                    <ul className="divide-y">
                      {fulfillment.lines.map((line) => {
                        const item = order.items.find((candidate) => candidate.id === line.item_id);
                        return item ? (
                          <ItemRow
                            key={line.item_id}
                            item={item}
                            quantity={line.quantity}
                            money={money}
                            dictionary={dictionary}
                          />
                        ) : null;
                      })}
                    </ul>
                  </SectionCard>
                ))}
              </>
            )}

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
        lang={lang}
        order={order}
        is_open={is_fulfill_open}
        onOpenChange={setIsFulfillOpen}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
      <TrackingDialog
        order={order}
        target={tracking_target}
        onClose={() => setTrackingTarget(null)}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
      <ConfirmDialog
        is_open={cancel_package_id !== null}
        onOpenChange={(is_open) => !is_open && setCancelPackageId(null)}
        title={dictionary.cancel_package_title}
        body={dictionary.cancel_package_body}
        confirm_label={dictionary.cancel_package}
        cancel_label={common.cancel}
        is_pending={cancel_package.isPending}
        is_destructive
        onConfirm={() =>
          cancel_package_id &&
          cancel_package.mutate(
            { id: order.id, fulfillment_id: cancel_package_id },
            {
              onSuccess: () => {
                setCancelPackageId(null);
                toast.success(dictionary.package_cancelled);
              },
              onError: (error) => toast.error(errorText(errors, error)),
            },
          )
        }
      />
    </Page>
  );
}

function ItemRow({
  item,
  quantity,
  money,
  dictionary,
}: {
  item: AdminOrderDetail["items"][number];
  // How many of the line this card is about (all of it, what is left, or what a package holds).
  quantity: number;
  money: (cents: number) => string;
  dictionary: AdminDictionary["orders_admin"]["detail"];
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
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
          {[item.variant_label, item.sku && dictionary.sku.replace("{sku}", item.sku)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        {money(item.unit_price)} × {quantity}
      </p>
      <p className="w-24 text-right text-sm font-medium tabular-nums">{money(item.unit_price * quantity)}</p>
    </li>
  );
}

function TrackingLine({
  tracking,
  dictionary,
  children,
}: {
  tracking: { carrier: string; tracking_number: string; tracking_url: string };
  dictionary: AdminDictionary["orders_admin"]["detail"];
  // Buttons for this package (edit tracking, cancel).
  children?: React.ReactNode;
}) {
  const label = [tracking.carrier, tracking.tracking_number].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">
        {label ? `${dictionary.tracking}: ${label}` : dictionary.no_tracking}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {tracking.tracking_url && (
          <a href={tracking.tracking_url} target="_blank" rel="noreferrer" className="hover:underline">
            {dictionary.track_package}
          </a>
        )}
        {children}
      </div>
    </div>
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
