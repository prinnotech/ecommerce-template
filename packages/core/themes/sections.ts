import type { LocalizedText } from "@repo/core/lib/localized";
import type { SectionOf, SectionType, ThemeData, ThemeSection } from "@repo/core/lib/schemas/theme";

// Starting content for each section type, in every store language. Templates combine these and
// override what makes them different; the editor uses them for "Add section".

const TEXT = {
  shop_now: { en: "Shop now", es: "Comprar ahora", it: "Acquista ora" },
  new_arrivals: { en: "New arrivals", es: "Novedades", it: "Novità" },
  featured: { en: "Featured", es: "Destacados", it: "In evidenza" },
  shop_by_category: { en: "Shop by category", es: "Compra por categoría", it: "Acquista per categoria" },
  hero_heading: {
    en: "Timeless pieces for every season",
    es: "Prendas atemporales para cada temporada",
    it: "Capi senza tempo per ogni stagione",
  },
  hero_subtitle: {
    en: "Curated clothing and accessories, made to be worn for years.",
    es: "Ropa y accesorios seleccionados, hechos para durar años.",
    it: "Abbigliamento e accessori selezionati, fatti per durare anni.",
  },
  story_heading: { en: "Our story", es: "Nuestra historia", it: "La nostra storia" },
  story_body: {
    en: "We choose every piece for its fabric, its fit and how long it will last.\n\nThat's why our collections are small, and why we restock the favourites.",
    es: "Elegimos cada prenda por su tejido, su corte y lo que va a durar.\n\nPor eso nuestras colecciones son pequeñas y reponemos las favoritas.",
    it: "Scegliamo ogni capo per il tessuto, la vestibilità e quanto durerà.\n\nPer questo le nostre collezioni sono piccole e riassortiamo i preferiti.",
  },
  image_heading: { en: "Made to last", es: "Hecho para durar", it: "Fatto per durare" },
  image_body: {
    en: "Natural fabrics, careful finishes and shapes that don't go out of style.",
    es: "Tejidos naturales, acabados cuidados y formas que no pasan de moda.",
    it: "Tessuti naturali, finiture curate e forme che non passano di moda.",
  },
  discover: { en: "Discover", es: "Descubrir", it: "Scopri" },
  newsletter_heading: { en: "Join our newsletter", es: "Suscríbete a la newsletter", it: "Iscriviti alla newsletter" },
  newsletter_body: {
    en: "New arrivals and private sales, a couple of times a month.",
    es: "Novedades y ventas privadas, un par de veces al mes.",
    it: "Novità e vendite private, un paio di volte al mese.",
  },
  about_eyebrow: { en: "Our story", es: "Nuestra historia", it: "La nostra storia" },
  about_heading: { en: "About us", es: "Sobre nosotros", it: "Chi siamo" },
  contact_eyebrow: { en: "Contact", es: "Contacto", it: "Contatti" },
  contact_heading: { en: "Get in touch", es: "Hablemos", it: "Scrivici" },
  contact_subtitle: {
    en: "Questions about an order, sizing or anything else? We usually reply within one business day.",
    es: "¿Preguntas sobre un pedido, tallas o cualquier otra cosa? Solemos responder en un día laborable.",
    it: "Domande su un ordine, sulle taglie o su altro? Di solito rispondiamo entro un giorno lavorativo.",
  },
  contact_form_heading: { en: "Send us a message", es: "Envíanos un mensaje", it: "Inviaci un messaggio" },
  related: { en: "You may also like", es: "También te puede gustar", it: "Potrebbe piacerti anche" },
  faq_heading: { en: "Frequently asked questions", es: "Preguntas frecuentes", it: "Domande frequenti" },
  faq_question: {
    en: "How long does delivery take?",
    es: "¿Cuánto tarda la entrega?",
    it: "Quanto tempo richiede la consegna?",
  },
  faq_answer: {
    en: "Orders ship within one business day; delivery times are shown at checkout.",
    es: "Los pedidos salen en un día laborable; los plazos de entrega se muestran al pagar.",
    it: "Gli ordini partono entro un giorno lavorativo; i tempi di consegna sono indicati al checkout.",
  },
  gallery_heading: { en: "Lookbook", es: "Lookbook", it: "Lookbook" },
} satisfies Record<string, LocalizedText>;

const NO_BUTTON = { label: {}, href: "" };

const DEFAULTS: { [T in SectionType]: () => SectionOf<T>["settings"] } = {
  hero: () => ({
    image_url: "",
    heading: TEXT.hero_heading,
    subtitle: TEXT.hero_subtitle,
    primary_button: { label: TEXT.shop_now, href: "/shop" },
    secondary_button: { label: TEXT.new_arrivals, href: "/shop?sort=newest" },
    alignment: "center",
    size: "large",
  }),
  trust_badges: () => ({}),
  category_tiles: () => ({ heading: TEXT.shop_by_category, category_ids: [], limit: 4 }),
  product_grid: () => ({
    heading: TEXT.featured,
    source: "featured",
    category_id: "",
    collection_id: "",
    limit: 8,
    show_view_all: true,
  }),
  image_with_text: () => ({
    image_url: "",
    heading: TEXT.image_heading,
    body: TEXT.image_body,
    button: { label: TEXT.discover, href: "/shop" },
    image_position: "left",
  }),
  rich_text: () => ({ heading: TEXT.story_heading, body: TEXT.story_body, alignment: "center" }),
  newsletter: () => ({ heading: TEXT.newsletter_heading, body: TEXT.newsletter_body }),
  faq: () => ({
    heading: TEXT.faq_heading,
    items: [{ id: newSectionId(), question: TEXT.faq_question, answer: TEXT.faq_answer }],
  }),
  gallery: () => ({ heading: TEXT.gallery_heading, images: [], columns: 3 }),
  video: () => ({ heading: {}, url: "", caption: {} }),
  spacer: () => ({ size: "medium", show_divider: false }),
  page_header: () => ({ eyebrow: {}, heading: TEXT.about_heading, subtitle: {}, alignment: "left" }),
  contact_form: () => ({ heading: TEXT.contact_form_heading, show_details: true }),
  product_main: () => ({ show_assurances: true }),
  related_products: () => ({ heading: TEXT.related, limit: 4 }),
};

export function newSectionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultSection<T extends SectionType>(
  type: T,
  overrides: Partial<SectionOf<T>["settings"]> = {},
  id: string = newSectionId(),
): ThemeSection {
  return { id, type, is_hidden: false, settings: { ...DEFAULTS[type](), ...overrides } } as ThemeSection;
}

export const SECTION_TEXT = { ...TEXT, no_button: NO_BUTTON };

// The product, About and Contact pages every template starts with; a template can replace any.
export function defaultPages(home: ThemeSection[]): ThemeData["pages"] {
  return {
    home,
    product: [defaultSection("product_main", {}, "product"), defaultSection("related_products", {}, "related")],
    about: [
      defaultSection("page_header", { eyebrow: TEXT.about_eyebrow, heading: TEXT.about_heading }, "header"),
      defaultSection("rich_text", { heading: {}, alignment: "left" }, "story"),
    ],
    contact: [
      defaultSection(
        "page_header",
        { eyebrow: TEXT.contact_eyebrow, heading: TEXT.contact_heading, subtitle: TEXT.contact_subtitle },
        "header",
      ),
      defaultSection("contact_form", {}, "form"),
    ],
  };
}
