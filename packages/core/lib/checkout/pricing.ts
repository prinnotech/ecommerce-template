// Order totals. Pure and shared: the server uses it as the source of truth, the cart page
// uses it only to preview (free-shipping progress). All amounts are integer cents.

// product_id lets a discount limited to some products find the lines it lowers.
export type PricingLine = { unit_price: number; quantity: number; product_id?: string };

export type PricingDiscount = {
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  min_subtotal: number;
  // Only these products are discounted (null = the whole order).
  product_ids?: string[] | null;
};

export type PricingInput = {
  lines: PricingLine[];
  // null until the customer picks a shipping method.
  shipping_price: number | null;
  free_shipping_threshold: number;
  discount: PricingDiscount | null;
  tax_rate: number;
  tax_included: boolean;
  // The chosen payment method's fee (cash on delivery or a manual method; 0 = none).
  payment_fee: number;
};

export type Totals = {
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  is_free_shipping: boolean;
  // The payment method's fee (the column is still called cod_fee).
  cod_fee: number;
  // Included taxes are informational ("including €X in taxes"); excluded ones are added.
  tax_total: number;
  total: number;
};

export function computeTotals(input: PricingInput): Totals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

  let discount_total = 0;
  const discount = input.discount && subtotal >= input.discount.min_subtotal ? input.discount : null;
  if (discount && discount.type !== "free_shipping") {
    const ids = discount.product_ids;
    const eligible = ids
      ? input.lines
          .filter((line) => line.product_id && ids.includes(line.product_id))
          .reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
      : subtotal;
    discount_total =
      discount.type === "percent"
        ? Math.round((eligible * Math.min(discount.value, 100)) / 100)
        : Math.min(discount.value, eligible);
  }
  const goods = subtotal - discount_total;

  const is_free_shipping =
    discount?.type === "free_shipping" || (input.free_shipping_threshold > 0 && goods >= input.free_shipping_threshold);
  const shipping_total = is_free_shipping ? 0 : (input.shipping_price ?? 0);
  const cod_fee = input.payment_fee;

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
