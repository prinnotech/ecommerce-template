// Order totals. Pure and shared: the server uses it as the source of truth, the cart page
// uses it only to preview (free-shipping progress). All amounts are integer cents.

export type PricingLine = { unit_price: number; quantity: number };

export type PricingDiscount = { type: "percent" | "fixed"; value: number; min_subtotal: number };

export type PricingInput = {
  lines: PricingLine[];
  // null until the customer picks a shipping method.
  shipping_price: number | null;
  free_shipping_threshold: number;
  discount: PricingDiscount | null;
  tax_rate: number;
  tax_included: boolean;
  cod_fee: number;
  is_cash_on_delivery: boolean;
};

export type Totals = {
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  is_free_shipping: boolean;
  cod_fee: number;
  // Included taxes are informational ("including €X in taxes"); excluded ones are added.
  tax_total: number;
  total: number;
};

export function computeTotals(input: PricingInput): Totals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

  let discount_total = 0;
  if (input.discount && subtotal >= input.discount.min_subtotal) {
    discount_total =
      input.discount.type === "percent"
        ? Math.round((subtotal * Math.min(input.discount.value, 100)) / 100)
        : Math.min(input.discount.value, subtotal);
  }
  const goods = subtotal - discount_total;

  const is_free_shipping = input.free_shipping_threshold > 0 && goods >= input.free_shipping_threshold;
  const shipping_total = is_free_shipping ? 0 : (input.shipping_price ?? 0);
  const cod_fee = input.is_cash_on_delivery ? input.cod_fee : 0;

  const rate = input.tax_rate / 100;
  const taxable = goods + shipping_total;
  const tax_total =
    rate <= 0 ? 0 : input.tax_included ? Math.round(taxable - taxable / (1 + rate)) : Math.round(taxable * rate);

  const total = goods + shipping_total + cod_fee + (input.tax_included ? 0 : tax_total);
  return { subtotal, discount_total, shipping_total, is_free_shipping, cod_fee, tax_total, total };
}

// How much more the customer needs to spend for free shipping (0 = already free or no offer).
export function freeShippingRemaining(goods: number, threshold: number): number {
  return threshold > 0 ? Math.max(threshold - goods, 0) : 0;
}
