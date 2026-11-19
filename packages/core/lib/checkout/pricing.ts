// Order totals. Pure and shared: the server uses it as the source of truth, the cart page
// uses it only to preview (free-shipping progress). All amounts are integer cents.

// product_id lets a discount limited to some products find the lines it lowers.
export type PricingLine = { unit_price: number; quantity: number; product_id?: string };

export type DiscountKind = "product" | "order" | "shipping";
export type Combinations = Record<DiscountKind, boolean>;

// Product ids a part of a discount is limited to (null = every product).
type ProductIds = string[] | null;

export type PricingDiscount = {
  // Discounts stored in the database have an id and a name for the summary; a draft order's
  // own discount has neither.
  id?: string;
  label?: string;
  type: "percent" | "fixed" | "free_shipping" | "buy_x_get_y";
  value: number;
  min_subtotal: number;
  // Only these products are discounted (null = the whole order).
  product_ids?: ProductIds;
  buy_x_get_y?: {
    buy: { kind: "quantity" | "amount"; value: number; product_ids: ProductIds };
    get: { quantity: number; percent: number; product_ids: ProductIds };
    max_uses: number;
  } | null;
  // Which other kinds of discount it may be used with (default: none).
  combines_with?: Combinations;
  // Typed by the customer: always kept, automatic discounts are added around it.
  is_code?: boolean;
};

export type PricingInput = {
  lines: PricingLine[];
  // null until the customer picks a shipping method.
  shipping_price: number | null;
  free_shipping_threshold: number;
  // Candidates: a typed code and every live automatic discount. computeTotals picks the ones
  // that apply and combine.
  discounts: PricingDiscount[];
  tax_rate: number;
  tax_included: boolean;
  // The chosen payment method's fee (cash on delivery or a manual method; 0 = none).
  payment_fee: number;
};

// One line per discount in the order summary. Free shipping has amount = the shipping saved.
export type AppliedDiscount = { id: string; label: string; type: PricingDiscount["type"]; amount: number };

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
  applied_discounts: AppliedDiscount[];
};

export function discountKind(discount: PricingDiscount): DiscountKind {
  if (discount.type === "free_shipping") return "shipping";
  if (discount.type === "buy_x_get_y" || discount.product_ids) return "product";
  return "order";
}

function matches(ids: ProductIds, line: PricingLine): boolean {
  return !ids || (line.product_id ? ids.includes(line.product_id) : false);
}

type Unit = { index: number; price: number; is_used: boolean };

// Buy X get Y: what it takes off each line. The dearest matching items "pay", the cheapest
// matching items get the discount.
function buyXGetYReductions(discount: PricingDiscount, lines: PricingLine[], remaining: number[]): number[] {
  const reductions = lines.map(() => 0);
  const deal = discount.buy_x_get_y;
  if (!deal) return reductions;
  // One entry per unit, so "the cheapest items" can be picked across lines.
  const units: Unit[] = lines.flatMap((line, index) =>
    Array.from({ length: line.quantity }, () => ({ index, price: line.unit_price, is_used: false })),
  );
  const inSet = (ids: ProductIds) => (unit: Unit) => !unit.is_used && matches(ids, lines[unit.index]!);
  const max_uses = deal.max_uses > 0 ? deal.max_uses : Number.POSITIVE_INFINITY;

  function discountCheapest(count: number): number {
    const picked = units
      .filter(inSet(deal!.get.product_ids))
      .sort((a, b) => a.price - b.price)
      .slice(0, count);
    for (const unit of picked) {
      unit.is_used = true;
      reductions[unit.index]! += Math.round((unit.price * deal!.get.percent) / 100);
    }
    return picked.length;
  }

  if (deal.buy.kind === "quantity") {
    for (let uses = 0; uses < max_uses; uses += 1) {
      const paid = units
        .filter(inSet(deal.buy.product_ids))
        .sort((a, b) => b.price - a.price)
        .slice(0, deal.buy.value);
      if (paid.length < deal.buy.value) break;
      for (const unit of paid) unit.is_used = true;
      if (discountCheapest(deal.get.quantity) === 0) break;
    }
  } else {
    const spent = lines
      .filter((line) => matches(deal.buy.product_ids, line))
      .reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
    const uses = Math.min(max_uses, Math.floor(spent / Math.max(deal.buy.value, 1)));
    for (let use = 0; use < uses; use += 1) {
      if (discountCheapest(deal.get.quantity) === 0) break;
    }
  }
  return reductions.map((amount, index) => Math.min(amount, remaining[index]!));
}

// What a product or order discount takes off each line, given what is left of each line.
function lineReductions(discount: PricingDiscount, lines: PricingLine[], remaining: number[]): number[] {
  if (discount.type === "buy_x_get_y") return buyXGetYReductions(discount, lines, remaining);

  const reductions = lines.map(() => 0);
  const eligible = lines.map((line, index) => (matches(discount.product_ids ?? null, line) ? remaining[index]! : 0));
  const base = eligible.reduce((sum, amount) => sum + amount, 0);
  if (base <= 0) return reductions;
  let left =
    discount.type === "percent"
      ? Math.round((base * Math.min(discount.value, 100)) / 100)
      : Math.min(discount.value, base);
  // Spread over the eligible lines in order, never below zero.
  eligible.forEach((amount, index) => {
    const taken = Math.min(amount, left);
    reductions[index] = taken;
    left -= taken;
  });
  return reductions;
}

function canCombine(a: PricingDiscount, b: PricingDiscount): boolean {
  return Boolean(a.combines_with?.[discountKind(b)] && b.combines_with?.[discountKind(a)]);
}

// The typed code always counts; automatic discounts join, biggest saving first, when they
// combine with everything already picked. Each saving is measured alone, on the full prices.
function pickDiscounts(input: PricingInput, subtotal: number): PricingDiscount[] {
  const eligible = input.discounts.filter((discount) => subtotal >= discount.min_subtotal);
  const full = input.lines.map((line) => line.unit_price * line.quantity);
  const saving = (discount: PricingDiscount) =>
    discountKind(discount) === "shipping"
      ? (input.shipping_price ?? 0)
      : lineReductions(discount, input.lines, full).reduce((sum, amount) => sum + amount, 0);

  const picked = eligible.filter((discount) => discount.is_code).slice(0, 1);
  const automatic = eligible
    .filter((discount) => !discount.is_code)
    .map((discount) => ({ discount, saving: saving(discount) }))
    .filter((item) => item.saving > 0)
    .sort((a, b) => b.saving - a.saving || (a.discount.id ?? "").localeCompare(b.discount.id ?? ""));
  for (const { discount } of automatic) {
    if (picked.every((other) => canCombine(discount, other))) picked.push(discount);
  }
  return picked;
}

const KIND_ORDER: Record<DiscountKind, number> = { product: 0, order: 1, shipping: 2 };

function appliedLine(discount: PricingDiscount, amount: number): AppliedDiscount {
  return { id: discount.id ?? "", label: discount.label ?? "", type: discount.type, amount };
}

export function computeTotals(input: PricingInput): Totals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
  const picked = pickDiscounts(input, subtotal).sort(
    (a, b) => KIND_ORDER[discountKind(a)] - KIND_ORDER[discountKind(b)],
  );

  // Product discounts lower their lines first; order discounts then work on what is left.
  const remaining = input.lines.map((line) => line.unit_price * line.quantity);
  const applied: AppliedDiscount[] = [];
  const shipping_discounts: PricingDiscount[] = [];
  for (const discount of picked) {
    if (discountKind(discount) === "shipping") {
      shipping_discounts.push(discount);
      continue;
    }
    const reductions = lineReductions(discount, input.lines, remaining);
    reductions.forEach((amount, index) => {
      remaining[index]! -= amount;
    });
    const amount = reductions.reduce((sum, value) => sum + value, 0);
    if (amount > 0 || discount.is_code) applied.push(appliedLine(discount, amount));
  }
  const goods = remaining.reduce((sum, amount) => sum + amount, 0);
  const discount_total = subtotal - goods;

  const is_threshold_free = input.free_shipping_threshold > 0 && goods >= input.free_shipping_threshold;
  const is_free_shipping = shipping_discounts.length > 0 || is_threshold_free;
  for (const discount of shipping_discounts) {
    // Already free by the threshold: the discount saves nothing, so it's listed only if typed.
    const amount = is_threshold_free ? 0 : (input.shipping_price ?? 0);
    if (amount > 0 || discount.is_code) applied.push(appliedLine(discount, amount));
  }
  const shipping_total = is_free_shipping ? 0 : (input.shipping_price ?? 0);
  const cod_fee = input.payment_fee;

  const rate = input.tax_rate / 100;
  const taxable = goods + shipping_total;
  const tax_total =
    rate <= 0 ? 0 : input.tax_included ? Math.round(taxable - taxable / (1 + rate)) : Math.round(taxable * rate);

  const total = goods + shipping_total + cod_fee + (input.tax_included ? 0 : tax_total);
  return {
    subtotal,
    discount_total,
    shipping_total,
    is_free_shipping,
    cod_fee,
    tax_total,
    total,
    applied_discounts: applied,
  };
}

// How much more the customer needs to spend for free shipping (0 = already free or no offer).
export function freeShippingRemaining(goods: number, threshold: number): number {
  return threshold > 0 ? Math.max(threshold - goods, 0) : 0;
}

// Summary lines for the discounts that lowered the goods (free shipping shows on the shipping
// line). Orders from before named discounts get one unnamed line for their discount_total.
export function discountLines(totals: {
  discount_total: number;
  applied_discounts: AppliedDiscount[];
}): { label: string; amount: number }[] {
  const lines = totals.applied_discounts
    .filter((discount) => discount.type !== "free_shipping" && discount.amount > 0)
    .map((discount) => ({ label: discount.label, amount: discount.amount }));
  const listed = lines.reduce((sum, line) => sum + line.amount, 0);
  if (totals.discount_total > listed) lines.push({ label: "", amount: totals.discount_total - listed });
  return lines;
}
