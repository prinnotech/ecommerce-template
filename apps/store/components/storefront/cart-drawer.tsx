"use client";

import { LockIcon, MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useCartLines, useCreateCheckout } from "@repo/core/hooks/use-cart";
import { useCartHydrated } from "@repo/core/hooks/use-cart-hydrated";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import { freeShippingRemaining } from "@repo/core/lib/checkout/pricing";
import type { Dictionary } from "@repo/core/lib/i18n";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { useCartDrawerStore } from "@repo/core/store/cart-drawer-store";
import { MAX_LINE_QUANTITY, useCartStore } from "@repo/core/store/cart-store";

type CartDrawerProps = {
  lang: string;
  currency: string;
  free_shipping_threshold: number;
  dictionary: Dictionary["cart"];
  errors: Dictionary["errors"];
  close_label: string;
  loading_label: string;
};

// Slide-in cart drawer (audit X7): opened on "add to cart" and from the header cart button.
export function CartDrawer({
  lang,
  currency,
  free_shipping_threshold,
  dictionary,
  errors,
  close_label,
  loading_label,
}: CartDrawerProps) {
  const router = useRouter();
  const is_open = useCartDrawerStore((state) => state.is_open);
  const close = useCartDrawerStore((state) => state.close);
  const is_hydrated = useCartHydrated();
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const locale: Locale = (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : LOCALES[0];
  const priced = useCartLines(lines, locale, is_hydrated);
  const create_checkout = useCreateCheckout();
  const money = (cents: number) => formatCurrency(cents, currency, lang);

  const items = priced.data?.lines ?? [];
  const subtotal = items.reduce((sum, line) => sum + line.line_total, 0);
  const remaining = freeShippingRemaining(subtotal, free_shipping_threshold);

  function onCheckout() {
    create_checkout.mutate(
      { lines, locale },
      {
        onSuccess: ({ id }) => {
          close();
          router.push(`/${lang}/checkout/${id}`);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <Sheet open={is_open} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" closeLabel={close_label} className="flex w-[88vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{dictionary.title}</SheetTitle>
        </SheetHeader>

        {!is_hydrated || (lines.length > 0 && priced.isPending) ? (
          <div className="flex flex-1 flex-col gap-3 p-4" aria-busy="true">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBagIcon className="text-muted-foreground size-10" strokeWidth={1.25} aria-hidden />
            <p className="font-medium">{dictionary.empty_title}</p>
            <p className="text-muted-foreground text-sm">{dictionary.empty_body}</p>
            <Button variant="outline" className="h-11" onClick={close}>
              {dictionary.continue_shopping}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-4">
              {items.map((line) => {
                const max = Math.min(line.stock, MAX_LINE_QUANTITY);
                return (
                  <li key={line.variant_id} className="flex gap-3 py-4">
                    <Link
                      href={`/${lang}/shop/${line.slug}`}
                      onClick={close}
                      className="bg-muted relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md"
                    >
                      {line.image ? (
                        <Image src={line.image} alt="" fill sizes="64px" unoptimized className="object-cover" />
                      ) : (
                        <span className="font-display text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[10px]">
                          {line.title}
                        </span>
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/${lang}/shop/${line.slug}`}
                            onClick={close}
                            className="line-clamp-2 text-sm font-medium hover:underline"
                          >
                            {line.title}
                          </Link>
                          {line.variant_label && <p className="text-muted-foreground text-xs">{line.variant_label}</p>}
                        </div>
                        <p className="text-sm font-medium tabular-nums">{money(line.line_total)}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <div
                          className="flex h-8 items-center rounded-md border"
                          role="group"
                          aria-label={dictionary.quantity}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-full rounded-r-none"
                            aria-label={dictionary.decrease.replace("{title}", line.title)}
                            onClick={() => setQuantity(line.variant_id, line.quantity - 1)}
                          >
                            <MinusIcon />
                          </Button>
                          <span className="w-6 text-center text-xs tabular-nums" aria-live="polite">
                            {line.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-full rounded-l-none"
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

            <div className="border-t p-4">
              {free_shipping_threshold > 0 && remaining > 0 && (
                <p className="text-muted-foreground mb-3 text-sm">
                  {dictionary.free_shipping_progress.replace("{amount}", money(remaining))}
                </p>
              )}
              <div className="mb-4 flex items-baseline justify-between">
                <span className="font-medium">{dictionary.subtotal}</span>
                <span className="text-lg font-semibold tabular-nums">{money(subtotal)}</span>
              </div>
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
                href={`/${lang}/cart`}
                onClick={close}
                className="text-muted-foreground hover:text-foreground mt-3 block text-center text-sm underline-offset-4 hover:underline"
              >
                {dictionary.view_cart}
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
