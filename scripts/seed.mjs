// Loads sample categories, products and variants for LOCAL testing only. Safe to re-run:
// existing slugs are skipped. Migrations never insert catalog data, so deploys start empty.
import PocketBase from "pocketbase";

process.loadEnvFile(".env.local");

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090");
await pb
  .collection("_superusers")
  .authWithPassword(process.env.POCKETBASE_SUPERUSER_EMAIL ?? "", process.env.POCKETBASE_SUPERUSER_PASSWORD ?? "");

const CATEGORIES = [
  { slug: "women", name: { en: "Women", es: "Mujer", it: "Donna" }, sort_order: 1 },
  { slug: "men", name: { en: "Men", es: "Hombre", it: "Uomo" }, sort_order: 2 },
  { slug: "accessories", name: { en: "Accessories", es: "Accesorios", it: "Accessori" }, sort_order: 3 },
];

const SIZES = ["XS", "S", "M", "L", "XL"];

const PRODUCTS = [
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

async function findBySlug(collection, slug) {
  return pb
    .collection(collection)
    .getFirstListItem(pb.filter("slug = {:slug}", { slug }))
    .catch(() => null);
}

const category_ids = {};
for (const category of CATEGORIES) {
  const existing = await findBySlug("categories", category.slug);
  category_ids[category.slug] = existing
    ? existing.id
    : (await pb.collection("categories").create({ ...category, is_active: true })).id;
}

let created = 0;
for (const product of PRODUCTS) {
  if (await findBySlug("products", product.slug)) continue;
  const { colors, one_size, category, ...fields } = product;
  const record = await pb
    .collection("products")
    .create({ ...fields, category: category_ids[category], status: "active" });

  let sort_order = 0;
  for (const { color, color_hex } of colors) {
    for (const size of one_size ? ["One size"] : SIZES) {
      const sku = `${product.slug}-${color}-${size}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      await pb.collection("product_variants").create({
        product: record.id,
        size,
        color,
        color_hex,
        sku,
        stock: 10,
        is_active: true,
        sort_order: sort_order++,
      });
    }
  }
  created++;
}

console.warn(`Seed done: ${CATEGORIES.length} categories checked, ${created} products created.`);
