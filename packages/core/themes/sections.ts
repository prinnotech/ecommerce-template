import type { LocalizedText } from "@repo/core/lib/localized";
import type {
  AnnouncementSettings,
  FooterSettings,
  HeaderSettings,
  SectionOf,
  SectionType,
  ThemeData,
  ThemeSection,
} from "@repo/core/lib/schemas/theme";

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
  latest_posts: { en: "From the journal", es: "Del blog", it: "Dal blog" },
  details: { en: "Details", es: "Detalles", it: "Dettagli" },
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
  slide_one_heading: { en: "The new collection", es: "La nueva colección", it: "La nuova collezione" },
  slide_one_subtitle: {
    en: "Fresh shapes and natural fabrics for the season ahead.",
    es: "Formas nuevas y tejidos naturales para la temporada.",
    it: "Forme nuove e tessuti naturali per la stagione.",
  },
  slide_two_heading: { en: "Made to last", es: "Hecho para durar", it: "Fatto per durare" },
  slide_two_subtitle: {
    en: "Pieces you'll keep wearing for years.",
    es: "Prendas que seguirás usando durante años.",
    it: "Capi che continuerai a indossare per anni.",
  },
  marquee_one: { en: "Free shipping over €100", es: "Envío gratis desde 100 €", it: "Spedizione gratuita da 100 €" },
  marquee_two: { en: "Easy 30-day returns", es: "Devoluciones fáciles en 30 días", it: "Resi facili entro 30 giorni" },
  marquee_three: { en: "Secure payment", es: "Pago seguro", it: "Pagamento sicuro" },
  collections_heading: { en: "Shop the collections", es: "Descubre las colecciones", it: "Scopri le collezioni" },
  multicolumn_heading: { en: "Why shop with us", es: "Por qué comprar con nosotros", it: "Perché acquistare da noi" },
  column_one_heading: { en: "Quality fabrics", es: "Tejidos de calidad", it: "Tessuti di qualità" },
  column_one_body: {
    en: "Natural fibres chosen to look good for years.",
    es: "Fibras naturales elegidas para durar años.",
    it: "Fibre naturali scelte per durare anni.",
  },
  column_two_heading: { en: "Fast delivery", es: "Entrega rápida", it: "Consegna rapida" },
  column_two_body: {
    en: "Orders leave within one business day.",
    es: "Los pedidos salen en un día laborable.",
    it: "Gli ordini partono entro un giorno lavorativo.",
  },
  column_three_heading: { en: "Easy returns", es: "Devoluciones fáciles", it: "Resi facili" },
  column_three_body: {
    en: "Changed your mind? Send it back within 30 days.",
    es: "¿Has cambiado de idea? Devuélvelo en 30 días.",
    it: "Hai cambiato idea? Restituiscilo entro 30 giorni.",
  },
  banner_heading: { en: "Effortless style", es: "Estilo sin esfuerzo", it: "Stile senza sforzo" },
  banner_body: {
    en: "Everyday pieces with a careful finish.",
    es: "Prendas para cada día con acabados cuidados.",
    it: "Capi per ogni giorno con finiture curate.",
  },
  testimonials_heading: {
    en: "What our customers say",
    es: "Lo que dicen nuestros clientes",
    it: "Cosa dicono i nostri clienti",
  },
  testimonial_one: {
    en: "Beautiful quality and it arrived in two days. I'll be back!",
    es: "Una calidad preciosa y llegó en dos días. ¡Volveré!",
    it: "Qualità bellissima ed è arrivato in due giorni. Tornerò!",
  },
  testimonial_two: {
    en: "The fit is perfect and the fabric feels wonderful.",
    es: "El corte es perfecto y el tejido es una maravilla.",
    it: "La vestibilità è perfetta e il tessuto è meraviglioso.",
  },
  footer_newsletter_heading: { en: "Stay in the loop", es: "No te pierdas nada", it: "Resta aggiornato" },
  footer_newsletter_body: {
    en: "New arrivals and offers in your inbox.",
    es: "Novedades y ofertas en tu correo.",
    it: "Novità e offerte nella tua casella email.",
  },
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
  product_list: () => ({ columns: 3, show_filters: true }),
  related_products: () => ({ heading: TEXT.related, limit: 4 }),
  custom_fields: () => ({ heading: TEXT.details, keys: "" }),
  slideshow: () => ({
    slides: [
      {
        id: newSectionId(),
        image_url: "",
        heading: TEXT.slide_one_heading,
        subtitle: TEXT.slide_one_subtitle,
        button: { label: TEXT.shop_now, href: "/shop" },
      },
      {
        id: newSectionId(),
        image_url: "",
        heading: TEXT.slide_two_heading,
        subtitle: TEXT.slide_two_subtitle,
        button: { label: TEXT.discover, href: "/about" },
      },
    ],
    autoplay_seconds: 6,
    height: "large",
    alignment: "center",
  }),
  marquee: () => ({
    items: [TEXT.marquee_one, TEXT.marquee_two, TEXT.marquee_three].map((text) => ({ id: newSectionId(), text })),
    speed: "medium",
    size: "small",
  }),
  collection_list: () => ({ heading: TEXT.collections_heading, collection_ids: [], columns: 3 }),
  blog_posts: () => ({ heading: TEXT.latest_posts, limit: 3, tag: "", show_view_all: true }),
  multicolumn: () => ({
    heading: TEXT.multicolumn_heading,
    columns: 3,
    alignment: "center",
    items: [
      [TEXT.column_one_heading, TEXT.column_one_body],
      [TEXT.column_two_heading, TEXT.column_two_body],
      [TEXT.column_three_heading, TEXT.column_three_body],
    ].map(([heading, body]) => ({ id: newSectionId(), image_url: "", heading, body, button: NO_BUTTON })),
  }),
  image_banner: () => ({
    image_url: "",
    heading: TEXT.banner_heading,
    body: TEXT.banner_body,
    button: { label: TEXT.shop_now, href: "/shop" },
    height: "medium",
    overlay: 30,
    alignment: "center",
  }),
  testimonials: () => ({
    heading: TEXT.testimonials_heading,
    items: [
      { id: newSectionId(), quote: TEXT.testimonial_one, author: "Giulia R.", rating: 5 },
      { id: newSectionId(), quote: TEXT.testimonial_two, author: "Laura M.", rating: 5 },
    ],
  }),
};

export function newSectionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultSection<T extends SectionType>(
  type: T,
  overrides: Partial<SectionOf<T>["settings"]> = {},
  id: string = newSectionId(),
): ThemeSection {
  return {
    id,
    type,
    is_hidden: false,
    color_scheme: "default",
    settings: { ...DEFAULTS[type](), ...overrides },
  } as ThemeSection;
}

// A copy with new ids for the section and for every list item inside it (FAQ items, images,
// slides…), so the copy's items never share keys with the original's.
export function duplicateSection(section: ThemeSection): ThemeSection {
  const renumber = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(renumber);
    if (typeof value !== "object" || value === null) return value;
    const entries = Object.entries(value).map(([key, inner]) => [key, renumber(inner)] as const);
    const copy = Object.fromEntries(entries);
    return "id" in copy && typeof copy.id === "string" ? { ...copy, id: newSectionId() } : copy;
  };
  return { ...section, id: newSectionId(), settings: renumber(section.settings) } as ThemeSection;
}

export const SECTION_TEXT = { ...TEXT, no_button: NO_BUTTON };

// The header and footer every template starts with; a template overrides what makes it different.
export function defaultHeaderGroup(
  header: Partial<HeaderSettings> = {},
  announcement: Partial<AnnouncementSettings> = {},
): ThemeData["header_group"] {
  return {
    announcement: { is_hidden: false, messages: [], autoplay_seconds: 5, color_scheme: "accent", ...announcement },
    header: {
      layout: "inline",
      is_sticky: true,
      show_utility_bar: false,
      logo_url: "",
      logo_width: 140,
      color_scheme: "default",
      ...header,
    },
  };
}

export function defaultFooterGroup(footer: Partial<FooterSettings> = {}): ThemeData["footer_group"] {
  return {
    footer: {
      show_newsletter: false,
      newsletter_heading: TEXT.footer_newsletter_heading,
      newsletter_body: TEXT.footer_newsletter_body,
      show_socials: true,
      copyright: {},
      color_scheme: "muted",
      ...footer,
    },
  };
}

// The product, About and Contact pages every template starts with; a template can replace any.
export function defaultPages(home: ThemeSection[]): ThemeData["pages"] {
  return {
    home,
    product: [defaultSection("product_main", {}, "product"), defaultSection("related_products", {}, "related")],
    collection: [defaultSection("product_list", {}, "product-list")],
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
