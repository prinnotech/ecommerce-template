import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClearCart } from "./components/clear-cart";
import { getOrderConfirmation } from "@/app/actions/checkout";
import { AddressBlock } from "@/components/address-block";
import { Button } from "@/components/ui/button";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout/[id]/thank-you">): Promise<Metadata> {
  const { lang, id } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: `/checkout/${id}/thank-you`,
    title: dictionary.thank_you.meta_title,
    is_private: true,
  });
}

export default async function ThankYouPage({ params }: PageProps<"/[lang]/checkout/[id]/thank-you">) {
  const { lang, id } = await params;
  const [result, dictionary] = await Promise.all([getOrderConfirmation(id), getDictionary(lang)]);
  if (!result.ok) notFound();

  const order = result.data;
  const text = dictionary.thank_you;
  const money = (cents: number) => formatCurrency(cents, order.currency, lang);
  const is_cod = order.payment_method === "cash_on_delivery";
  const rows = [
    { label: dictionary.checkout.subtotal, value: money(order.totals.subtotal), is_shown: true },
    {
      label: dictionary.checkout.discount,
      value: `−${money(order.totals.discount_total)}`,
      is_shown: order.totals.discount_total > 0,
    },
    {
      label: dictionary.checkout.shipping,
      value: order.totals.shipping_total === 0 ? dictionary.checkout.free : money(order.totals.shipping_total),
      is_shown: true,
    },
    {
      label: dictionary.checkout.cod_fee_label,
      value: money(order.totals.cod_fee),
      is_shown: order.totals.cod_fee > 0,
    },
  ].filter((row) => row.is_shown);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-16">
      <ClearCart />
      <div className="flex flex-col gap-8">
        <div className="flex items-start gap-4">
          <CircleCheckIcon className="text-primary mt-1 size-10 shrink-0" strokeWidth={1.25} aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">
              {text.order_number.replace("{number}", String(order.order_number))}
            </p>
            <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{text.title}</h1>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border p-5">
          <h2 className="font-semibold">{text.confirmed}</h2>
          <p className="text-muted-foreground text-sm">{text.confirmed_body.replace("{email}", order.email)}</p>
          {is_cod && (
            <p className="bg-muted mt-2 rounded-md px-3 py-2 text-sm font-medium">
              {text.cod_body.replace("{amount}", money(order.totals.total))}
            </p>
          )}
        </div>

        <div className="grid gap-6 rounded-xl border p-5 sm:grid-cols-2">
          {order.shipping_address && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{text.shipping_address}</h2>
              <AddressBlock address={order.shipping_address} lang={lang} />
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">{text.shipping_method}</h2>
              <p className="text-muted-foreground text-sm">{order.shipping_method}</p>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">{text.payment}</h2>
              <p className="text-muted-foreground text-sm">
                {is_cod ? dictionary.payment_method.cash_on_delivery : dictionary.payment_method.card} ·{" "}
                {money(order.totals.total)}
              </p>
            </div>
          </div>
        </div>

        {order.is_guest ? (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">{text.create_account}</p>
            <Button asChild variant="outline">
              <Link href={`/${lang}/auth/register`}>{text.create_account_cta}</Link>
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 px-8">
            <Link href={`/${lang}/shop`}>{text.continue}</Link>
          </Button>
          {!order.is_guest && (
            <Button asChild size="lg" variant="outline" className="h-12 px-8">
              <Link href={`/${lang}/account/orders`}>{text.view_orders}</Link>
            </Button>
          )}
        </div>
      </div>

      <aside className="bg-muted/40 flex h-fit flex-col gap-5 rounded-xl border p-6">
        <ul className="flex flex-col gap-4">
          {order.lines.map((line) => (
            <li key={line.variant_id} className="flex items-center gap-3">
              <div className="bg-background relative size-14 shrink-0 overflow-hidden rounded-lg border">
                {line.image && <Image src={line.image} alt="" fill sizes="56px" unoptimized className="object-cover" />}
                <span className="bg-muted-foreground text-background absolute top-0 right-0 flex size-5 items-center justify-center rounded-bl-md text-xs">
                  {line.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.title}</p>
                {line.variant_label && <p className="text-muted-foreground text-xs">{line.variant_label}</p>}
              </div>
              <p className="text-sm tabular-nums">{money(line.line_total)}</p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t pt-4 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="tabular-nums">{row.value}</dd>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-base font-semibold">
            <dt>{dictionary.checkout.total}</dt>
            <dd className="tabular-nums">{money(order.totals.total)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
