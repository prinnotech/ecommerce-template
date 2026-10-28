"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { StoreVariant } from "@/app/actions/storefront";
import { discountPercent, ProductPrice } from "@/components/storefront/product-price";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { compareSizes } from "@/lib/size-order";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { MAX_LINE_QUANTITY, useCartStore } from "@/store/cart-store";

const LOW_STOCK = 5;

type ProductPurchaseProps = {
  lang: string;
  title: string;
  variants: StoreVariant[];
  compare_at_price: number;
  currency: string;
  dictionary: Dictionary["store"]["product"];
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function ProductPurchase({
  lang,
  title,
  variants,
  compare_at_price,
  currency,
  dictionary,
}: ProductPurchaseProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const cart_lines = useCartStore((state) => state.lines);
  const add_button = useRef<HTMLButtonElement>(null);
  const [is_bar_visible, setIsBarVisible] = useState(false);

  // Distinct colors in the admin's variant order.
  const colors: { name: string; hex: string; in_stock: boolean }[] = [];
  for (const variant of variants) {
    const existing = colors.find((color) => same(color.name, variant.color));
    if (existing) existing.in_stock ||= variant.stock > 0;
    else colors.push({ name: variant.color, hex: variant.color_hex, in_stock: variant.stock > 0 });
  }
  const has_colors = colors.some((color) => color.name);

  const [color, setColor] = useState(() => (colors.find((item) => item.in_stock) ?? colors[0])?.name ?? "");
  const color_variants = variants
    .filter((variant) => !has_colors || same(variant.color, color))
    .sort((a, b) => compareSizes(a.size, b.size));
  const has_sizes = color_variants.some((variant) => variant.size);
  // Preselect when there's only one size (e.g. "One size") so it's one tap to buy.
  const [size, setSize] = useState(() => (color_variants.length === 1 ? color_variants[0].size : ""));
  const [quantity, setQuantity] = useState(1);
  const [is_size_missing, setIsSizeMissing] = useState(false);

  const selected = has_sizes ? color_variants.find((variant) => same(variant.size, size)) : color_variants[0];
  const prices = color_variants.map((variant) => variant.price);
  const display_price = selected?.price ?? (prices.length > 0 ? Math.min(...prices) : 0);
  const is_sold_out = color_variants.every((variant) => variant.stock <= 0);
  const in_cart = selected ? (cart_lines.find((line) => line.variant_id === selected.id)?.quantity ?? 0) : 0;
  const max_quantity = selected
    ? Math.max(0, Math.min(selected.stock, MAX_LINE_QUANTITY) - in_cart)
    : MAX_LINE_QUANTITY;
  const discount = discountPercent(display_price, compare_at_price);

  // Shows the sticky bar on mobile once the main Add to cart button scrolls out of view.
  useEffect(() => {
    const button = add_button.current;
    if (!button) return;
    const observer = new IntersectionObserver(([entry]) =>
      setIsBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  function onColor(name: string) {
    setColor(name);
    // Keep the chosen size if the new color has it in stock.
    const keeps_size = variants.some(
      (variant) => same(variant.color, name) && same(variant.size, size) && variant.stock > 0,
    );
    if (!keeps_size) {
      const options = variants.filter((variant) => same(variant.color, name));
      setSize(options.length === 1 ? options[0].size : "");
    }
    setQuantity(1);
  }

  function onAdd() {
    if (has_sizes && !selected) {
      setIsSizeMissing(true);
      document.getElementById("size-options")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!selected || selected.stock <= 0) return;
    if (max_quantity <= 0) {
      toast.error(dictionary.max_reached);
      return;
    }
    addItem(selected.id, Math.min(quantity, max_quantity), selected.stock);
    setQuantity(1);
    const label = [title, selected.color, selected.size].filter(Boolean).join(" · ");
    toast.success(dictionary.added, {
      description: label,
      action: { label: dictionary.view_cart, onClick: () => router.push(`/${lang}/cart`) },
    });
  }

  if (variants.length === 0) {
    return <p className="text-muted-foreground text-sm">{dictionary.no_variants}</p>;
  }

  const button_label = is_sold_out || (selected && selected.stock <= 0) ? dictionary.sold_out : dictionary.add_to_cart;
  const is_button_disabled = is_sold_out || (selected !== undefined && selected.stock <= 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <ProductPrice
          price={display_price}
          compare_at_price={compare_at_price}
          currency={currency}
          lang={lang}
          size="lg"
        />
        {discount > 0 && (
          <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1 text-xs font-semibold">
            {dictionary.save.replace("{amount}", formatCurrency(compare_at_price - display_price, currency, lang))}
          </span>
        )}
      </div>

      {has_colors && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm">
            <span className="text-muted-foreground">{dictionary.color}:</span>{" "}
            <span className="font-medium">{color}</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {colors.map((option) => {
              const is_active = same(option.name, color);
              return (
                <button
                  key={option.name}
                  type="button"
                  aria-pressed={is_active}
                  aria-label={option.name}
                  title={option.name}
                  onClick={() => onColor(option.name)}
                  className={cn(
                    "relative size-9 rounded-full ring-offset-2 transition",
                    is_active ? "ring-foreground ring-2" : "ring-border hover:ring-foreground/50 ring-1",
                    !option.in_stock && "opacity-40",
                  )}
                  style={{ backgroundColor: option.hex || undefined }}
                >
                  {!option.in_stock && (
                    <span className="bg-foreground absolute top-1/2 left-0 h-px w-full -rotate-45" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {has_sizes && (
        <fieldset
          id="size-options"
          className="flex flex-col gap-3"
          aria-describedby={is_size_missing ? "size-error" : undefined}
        >
          <legend className="mb-3 text-sm">
            <span className="text-muted-foreground">{dictionary.size}:</span>{" "}
            <span className="font-medium">{size || "—"}</span>
          </legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {color_variants.map((variant) => {
              const is_active = same(variant.size, size);
              const is_out = variant.stock <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  aria-pressed={is_active}
                  disabled={is_out}
                  aria-label={is_out ? `${variant.size} (${dictionary.sold_out})` : variant.size}
                  onClick={() => {
                    setSize(variant.size);
                    setIsSizeMissing(false);
                    setQuantity(1);
                  }}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium transition-colors",
                    is_active ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground",
                    is_out && "text-muted-foreground cursor-not-allowed line-through opacity-60 hover:border-border",
                    is_size_missing && !is_active && "border-destructive/60",
                  )}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
          {is_size_missing && (
            <p id="size-error" role="alert" className="text-destructive text-sm">
              {dictionary.select_size}
            </p>
          )}
        </fieldset>
      )}

      {selected && selected.stock > 0 && (
        <p
          className={cn(
            "flex items-center gap-2 text-sm",
            selected.stock <= LOW_STOCK ? "text-destructive font-medium" : "text-muted-foreground",
          )}
        >
          <span
            className={cn("size-2 rounded-full", selected.stock <= LOW_STOCK ? "bg-destructive" : "bg-primary")}
            aria-hidden
          />
          {selected.stock <= LOW_STOCK
            ? dictionary.low_stock.replace("{count}", String(selected.stock))
            : dictionary.in_stock}
        </p>
      )}

      <div className="flex gap-3">
        <div className="flex h-12 items-center rounded-md border" role="group" aria-label={dictionary.quantity}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full rounded-r-none"
            aria-label={dictionary.decrease}
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          >
            <MinusIcon />
          </Button>
          <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full rounded-l-none"
            aria-label={dictionary.increase}
            disabled={quantity >= Math.max(1, max_quantity)}
            onClick={() => setQuantity((value) => value + 1)}
          >
            <PlusIcon />
          </Button>
        </div>
        <Button
          ref={add_button}
          type="button"
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={is_button_disabled}
          onClick={onAdd}
        >
          {button_label}
        </Button>
      </div>

      {/* Sticky mobile bar: keeps the main action one tap away while reading details. */}
      <div
        className={cn(
          "bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 backdrop-blur transition-transform lg:hidden",
          is_bar_visible ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!is_bar_visible}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatCurrency(display_price, currency, lang)}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11"
            disabled={is_button_disabled}
            tabIndex={is_bar_visible ? 0 : -1}
            onClick={onAdd}
          >
            {button_label}
          </Button>
        </div>
      </div>
    </div>
  );
}
