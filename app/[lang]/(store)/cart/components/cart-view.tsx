"use client";

import { LockIcon, MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCartLines, useCreateCheckout } from "@/hooks/use-cart";
import { useCartHydrated } from "@/hooks/use-cart-hydrated";
import { LOCALES, type Locale } from "@/i18nConfig";
import { errorText } from "@/lib/action-result";
import { freeShippingRemaining } from "@/lib/checkout/pricing";
import type { Dictionary } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/format";
import { MAX_LINE_QUANTITY, useCartStore } from "@/store/cart-store";

type CartViewProps = {
  lang: string;
  currency: string;
  free_shipping_threshold: number;
  tax_included: boolean;
  assurances: { title: string; body: string }[];
  dictionary: Dictionary["cart"];
  errors: Dictionary["errors"];
  loading_label: string;
};

export function CartView({
  lang,
  currency,
  free_shipping_threshold,
  tax_included,
  assurances,
  dictionary,
  errors,
  loading_label,
}: CartViewProps) {
  const router = useRouter();
  const is_hydrated = useCartHydrated();
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const locale: Locale = (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : LOCALES[0];
  const priced = useCartLines(lines, locale, is_hydrated);
  const create_checkout = useCreateCheckout();
  const money = (cents: number) => formatCurrency(cents, currency, lang);

  // Keep the saved cart in line with what's actually available.
  const removed = priced.data?.removed ?? [];
  const adjusted = priced.data?.adjusted ?? [];
  useEffect(() => {
    if (!priced.data) return;
    for (const variant_id of priced.data.removed) removeItem(variant_id);
    for (const line of priced.data.lines) {
      if (priced.data.adjusted.includes(line.variant_id)) setQuantity(line.variant_id, line.quantity);
    }
  }, [priced.data, removeItem, setQuantity]);

  function onCheckout() {
    create_checkout.mutate(
      { lines, locale },
      {
        onSuccess: ({ id }) => router.push(`/${lang}/checkout/${id}`),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  const heading = (
    <h1 className="font-display mb-8 text-3xl font-medium tracking-tight sm:text-5xl">{dictionary.title}</h1>
  );

  if (!is_hydrated || (lines.length > 0 && priced.isPending)) {
    return (
      <div aria-busy="true">
        {heading}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (lines.length === 0 || (priced.data && priced.data.lines.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <ShoppingBagIcon className="text-muted-foreground size-10" strokeWidth={1.25} aria-hidden />
        <h1 className="font-display text-3xl font-medium tracking-tight">{dictionary.empty_title}</h1>
        <p className="text-muted-foreground">{dictionary.empty_body}</p>
        {removed.length > 0 && <p className="text-sm">{dictionary.items_removed}</p>}
        <Button asChild size="lg" className="h-12 px-8">
          <Link href={`/${lang}/shop`}>{dictionary.continue_shopping}</Link>
        </Button>
      </div>
    );
  }

  if (priced.isError) return <p className="text-destructive text-sm">{errorText(errors, priced.error)}</p>;

  const items = priced.data?.lines ?? [];
  const subtotal = items.reduce((sum, line) => sum + line.line_total, 0);
  const remaining = freeShippingRemaining(subtotal, free_shipping_threshold);
  const progress = free_shipping_threshold > 0 ? Math.min(100, (subtotal / free_shipping_threshold) * 100) : 0;

  return (
    <div>
      {heading}
      {(removed.length > 0 || adjusted.length > 0) && (
        <div role="status" className="bg-muted mb-6 rounded-lg px-4 py-3 text-sm">
          {removed.length > 0 ? dictionary.items_removed : dictionary.items_adjusted}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="divide-y border-y">
          {items.map((line) => {
            const max = Math.min(line.stock, MAX_LINE_QUANTITY);
            return (
              <li key={line.variant_id} className="flex gap-4 py-5">
                <Link
                  href={`/${lang}/shop/${line.slug}`}
                  className="bg-muted relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-md sm:w-28"
                >
                  {line.image ? (
                    <Image src={line.image} alt="" fill sizes="112px" unoptimized className="object-cover" />
                  ) : (
                    <span className="font-display text-muted-foreground flex size-full items-center justify-center p-2 text-center text-xs">
                      {line.title}
                    </span>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/${lang}/shop/${line.slug}`} className="font-medium hover:underline">
                        {line.title}
                      </Link>
                      {line.variant_label && <p className="text-muted-foreground text-sm">{line.variant_label}</p>}
                      <p className="text-muted-foreground text-sm tabular-nums">{money(line.unit_price)}</p>
                    </div>
                    <p className="font-medium tabular-nums">{money(line.line_total)}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-3 pt-2">
                    <div
                      className="flex h-9 items-center rounded-md border"
                      role="group"
                      aria-label={dictionary.quantity}
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.decrease.replace("{title}", line.title)}
                        onClick={() => setQuantity(line.variant_id, line.quantity - 1)}
                      >
                        <MinusIcon />
                      </Button>
                      <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">
                        {line.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.increase.replace("{title}", line.title)}
                        disabled={line.quantity >= max}
                        onClick={() => setQuantity(line.variant_id, Math.min(line.quantity + 1, max))}
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label={dictionary.remove.replace("{title}", line.title)}
                      onClick={() => removeItem(line.variant_id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-muted/40 flex flex-col gap-5 rounded-xl border p-6">
            {free_shipping_threshold > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  {remaining > 0
                    ? dictionary.free_shipping_progress.replace("{amount}", money(remaining))
                    : dictionary.free_shipping_unlocked}
                </p>
                <div
                  className="bg-border h-1.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{dictionary.subtotal}</span>
              <span className="text-xl font-semibold tabular-nums">{money(subtotal)}</span>
            </div>
            <p className="text-muted-foreground -mt-3 text-sm">
              {tax_included ? dictionary.taxes_included : dictionary.taxes_added} {dictionary.shipping_note}
            </p>
            <Button
              size="lg"
              className="h-12 w-full text-base"
              onClick={onCheckout}
              disabled={create_checkout.isPending || priced.isFetching}
            >
              {create_checkout.isPending ? <Spinner aria-label={loading_label} /> : <LockIcon />}
              {dictionary.checkout}
            </Button>
            <Link
              href={`/${lang}/shop`}
              className="text-muted-foreground hover:text-foreground text-center text-sm underline-offset-4 hover:underline"
            >
              {dictionary.continue_shopping}
            </Link>
          </div>
          <ul className="text-muted-foreground flex flex-col gap-2 px-1 text-sm">
            {assurances.map((item) => (
              <li key={item.title}>
                <span className="text-foreground font-medium">{item.title}</span> · {item.body}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
