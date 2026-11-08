// Shared sample catalog data + seeder, used by both `seed.mjs` and `demo.mjs`.
// Backend-neutral: takes the seed backend from `seed-backend.mjs`.

export const CATEGORIES = [
  { slug: "women", name: { en: "Women", es: "Mujer", it: "Donna" }, sort_order: 1 },
  { slug: "men", name: { en: "Men", es: "Hombre", it: "Uomo" }, sort_order: 2 },
  { slug: "accessories", name: { en: "Accessories", es: "Accesorios", it: "Accessori" }, sort_order: 3 },
];

export const SIZES = ["XS", "S", "M", "L", "XL"];

export const PRODUCTS = [
  {
    slug: "linen-shirt",
    category: "men",
    title: { en: "Linen shirt", es: "Camisa de lino", it: "Camicia di lino" },
    description: {
      en: "Breathable linen shirt with a relaxed fit.",
      es: "Camisa de lino transpirable de corte relajado.",
      it: "Camicia in lino traspirante dalla vestibilità comoda.",
    },
    price: 5900,
    colors: [
      { color: "White", color_hex: "#f5f5f0" },
      { color: "Sand", color_hex: "#d8c7a5" },
    ],
  },
  {
    slug: "wool-coat",
    category: "women",
    title: { en: "Wool coat", es: "Abrigo de lana", it: "Cappotto di lana" },
    description: {
      en: "Double-breasted wool coat, fully lined.",
      es: "Abrigo cruzado de lana, totalmente forrado.",
      it: "Cappotto doppiopetto in lana, completamente foderato.",
    },
    price: 18900,
    compare_at_price: 22900,
    is_featured: true,
    colors: [
      { color: "Camel", color_hex: "#b98a5a" },
      { color: "Black", color_hex: "#1c1c1c" },
    ],
  },
  {
    slug: "silk-dress",
    category: "women",
    title: { en: "Silk midi dress", es: "Vestido midi de seda", it: "Abito midi in seta" },
    description: {
      en: "Bias-cut silk dress that moves with you.",
      es: "Vestido de seda cortado al bies que se mueve contigo.",
      it: "Abito in seta tagliato in sbieco che si muove con te.",
    },
    price: 14900,
    is_featured: true,
    colors: [{ color: "Emerald", color_hex: "#1f6f50" }],
  },
  {
    slug: "leather-belt",
    category: "accessories",
    title: { en: "Leather belt", es: "Cinturón de cuero", it: "Cintura in pelle" },
    description: {
      en: "Full-grain leather belt with a brass buckle.",
      es: "Cinturón de cuero de plena flor con hebilla de latón.",
      it: "Cintura in pelle pieno fiore con fibbia in ottone.",
    },
    price: 4500,
    one_size: true,
    colors: [{ color: "Brown", color_hex: "#5b3a24" }],
  },
];

// Safe to re-run: existing slugs are skipped. Returns { category_ids, created }.
export async function seedCatalog(backend) {
  const category_ids = {};
  for (const category of CATEGORIES) {
    category_ids[category.slug] = await backend.upsertCategory(category);
  }

  let created = 0;
  for (const product of PRODUCTS) {
    const { colors, one_size, category, ...fields } = product;
    const { id, is_new } = await backend.upsertProduct({
      ...fields,
      category_id: category_ids[category],
      status: "active",
    });
    if (!is_new) continue;

    let sort_order = 0;
    for (const { color, color_hex } of colors) {
      for (const size of one_size ? ["One size"] : SIZES) {
        const sku = `${product.slug}-${color}-${size}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
        await backend.upsertVariant({
          product_id: id,
          sku,
          size,
          color,
          color_hex,
          stock: 10,
          sort_order: sort_order++,
        });
      }
    }
    created++;
  }

  return { category_ids, created };
}
