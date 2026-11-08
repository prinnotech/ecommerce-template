// Clothing sizes in the order shoppers expect; anything else (numbers, "One size") follows.
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL"];

export function compareSizes(a: string, b: string): number {
  const rank_a = SIZE_ORDER.indexOf(a.toUpperCase());
  const rank_b = SIZE_ORDER.indexOf(b.toUpperCase());
  if (rank_a !== -1 && rank_b !== -1) return rank_a - rank_b;
  if (rank_a !== -1) return -1;
  if (rank_b !== -1) return 1;
  const number_a = Number(a);
  const number_b = Number(b);
  if (!Number.isNaN(number_a) && !Number.isNaN(number_b)) return number_a - number_b;
  return a.localeCompare(b);
}
