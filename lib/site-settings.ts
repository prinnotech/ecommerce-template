import { z } from "zod";

import { LOCALES } from "@/i18nConfig";
import { localized_text_schema } from "@/lib/localized";

// The site settings contract (style guide §12). Adding a setting:
// 1. add an entry here, 2. add its label under settings.items.<lowercase_key> in en/es/it, 3. read it.
// No migration is needed: missing or invalid stored values fall back to `default_value`.

export type SettingCategory =
  "general" | "storefront" | "contact" | "localization" | "shipping" | "payments" | "content";

export type SettingInput =
  | "text"
  | "url"
  | "number"
  | "boolean"
  | "currency"
  | "locale"
  | "timezone"
  | "object"
  | "json"
  | "localized_text"
  // Long text per locale (about page, legal pages): plain paragraphs separated by blank lines.
  | "localized_long_text"
  | "money"
  | "shipping_rates";

type SettingDefinition<S extends z.ZodType> = {
  category: SettingCategory;
  schema: S;
  default_value: z.infer<S>;
  is_public: boolean;
  input: SettingInput;
};

function setting<S extends z.ZodType>(definition: SettingDefinition<S>): SettingDefinition<S> {
  return definition;
}

const cents_schema = z.number().int().min(0);

export const shipping_rate_schema = z.object({
  id: z.string().min(1).max(50),
  name: localized_text_schema,
  price: cents_schema,
  min_days: z.number().int().min(0),
  max_days: z.number().int().min(0),
});
export type ShippingRate = z.infer<typeof shipping_rate_schema>;

export const SITE_SETTINGS = {
  // General
  SITE_NAME: setting({
    category: "general",
    schema: z.string().min(1).max(100),
    default_value: "Boutique Pence 1979",
    is_public: true,
    input: "text",
  }),
  SITE_DESCRIPTION: setting({
    category: "general",
    schema: localized_text_schema,
    default_value: {
      en: "Timeless clothing, curated since 1979.",
      es: "Ropa atemporal, seleccionada desde 1979.",
      it: "Abbigliamento senza tempo, selezionato dal 1979.",
    },
    is_public: true,
    input: "localized_text",
  }),
  SITE_LOGO_URL: setting({
    category: "general",
    schema: z.union([z.url(), z.literal("")]),
    default_value: "",
    is_public: true,
    input: "url",
  }),
  MAINTENANCE_MODE: setting({
    category: "general",
    schema: z.boolean(),
    default_value: false,
    is_public: true,
    input: "boolean",
  }),

  // Contact
  SITE_CONTACT: setting({
    category: "contact",
    schema: z.object({
      email: z.union([z.email(), z.literal("")]),
      phone: z.string().max(30),
      whatsapp: z.string().max(30),
    }),
    default_value: { email: "", phone: "", whatsapp: "" },
    is_public: true,
    input: "object",
  }),
  STORE_ADDRESS: setting({
    category: "contact",
    schema: z.object({
      street: z.string().max(200),
      city: z.string().max(100),
      region: z.string().max(100),
      postal_code: z.string().max(20),
      country: z.string().max(2),
    }),
    default_value: { street: "", city: "", region: "", postal_code: "", country: "" },
    is_public: true,
    input: "object",
  }),
  SOCIAL_LINKS: setting({
    category: "contact",
    schema: z.object({
      instagram: z.union([z.url(), z.literal("")]),
      facebook: z.union([z.url(), z.literal("")]),
      tiktok: z.union([z.url(), z.literal("")]),
    }),
    default_value: { instagram: "", facebook: "", tiktok: "" },
    is_public: true,
    input: "object",
  }),

  // Localization
  CURRENCY: setting({
    category: "localization",
    schema: z.string().regex(/^[A-Z]{3}$/),
    default_value: "EUR",
    is_public: true,
    input: "currency",
  }),
  DEFAULT_LOCALE: setting({
    category: "localization",
    schema: z.enum(LOCALES),
    default_value: "en",
    is_public: true,
    input: "locale",
  }),
  TIMEZONE: setting({
    category: "localization",
    schema: z.string().min(1).max(64),
    default_value: "Europe/Rome",
    is_public: true,
    input: "timezone",
  }),

  // Shipping and tax (amounts in cents)
  SHIPPING_RATES: setting({
    category: "shipping",
    schema: z.array(shipping_rate_schema).min(1),
    default_value: [
      {
        id: "standard",
        name: { en: "Standard", es: "Estándar", it: "Standard" },
        price: 500,
        min_days: 3,
        max_days: 5,
      },
      { id: "express", name: { en: "Express", es: "Exprés", it: "Espresso" }, price: 1500, min_days: 1, max_days: 2 },
    ],
    is_public: true,
    input: "shipping_rates",
  }),
  FREE_SHIPPING_THRESHOLD: setting({
    category: "shipping",
    // 0 turns free shipping off.
    schema: cents_schema,
    default_value: 0,
    is_public: true,
    input: "money",
  }),
  TAX_RATE: setting({
    category: "shipping",
    // Percent, e.g. 22 for 22%.
    schema: z.number().min(0).max(100),
    default_value: 0,
    is_public: true,
    input: "number",
  }),
  TAX_INCLUDED: setting({
    category: "shipping",
    schema: z.boolean(),
    default_value: true,
    is_public: true,
    input: "boolean",
  }),

  // Payments
  PAYMENT_METHODS: setting({
    category: "payments",
    schema: z.object({ card: z.boolean(), cash_on_delivery: z.boolean() }),
    default_value: { card: true, cash_on_delivery: true },
    is_public: true,
    input: "object",
  }),
  COD_FEE: setting({
    category: "payments",
    schema: cents_schema,
    default_value: 0,
    is_public: true,
    input: "money",
  }),

  // Storefront (home page and conversion messages)
  HERO_TITLE: setting({
    category: "storefront",
    schema: localized_text_schema,
    default_value: {
      en: "Timeless pieces for every season",
      es: "Prendas atemporales para cada temporada",
      it: "Capi senza tempo per ogni stagione",
    },
    is_public: true,
    input: "localized_text",
  }),
  HERO_SUBTITLE: setting({
    category: "storefront",
    schema: localized_text_schema,
    default_value: {
      en: "Curated clothing and accessories, made to be worn for years.",
      es: "Ropa y accesorios seleccionados, hechos para durar años.",
      it: "Abbigliamento e accessori selezionati, fatti per durare anni.",
    },
    is_public: true,
    input: "localized_text",
  }),
  HERO_IMAGE_URL: setting({
    category: "storefront",
    schema: z.union([z.url(), z.literal("")]),
    default_value: "",
    is_public: true,
    input: "url",
  }),
  // Empty = show the free-shipping message (when FREE_SHIPPING_THRESHOLD is set), or nothing.
  ANNOUNCEMENT: setting({
    category: "storefront",
    schema: localized_text_schema,
    default_value: {},
    is_public: true,
    input: "localized_text",
  }),
  // 0 hides return messages.
  RETURNS_DAYS: setting({
    category: "storefront",
    schema: z.number().int().min(0).max(365),
    default_value: 30,
    is_public: true,
    input: "number",
  }),

  // Content
  ABOUT_CONTENT: setting({
    category: "content",
    schema: localized_text_schema,
    default_value: {},
    is_public: true,
    input: "localized_long_text",
  }),
  PRIVACY_POLICY: setting({
    category: "content",
    schema: localized_text_schema,
    default_value: {},
    is_public: true,
    input: "localized_long_text",
  }),
  TERMS_AND_CONDITIONS: setting({
    category: "content",
    schema: localized_text_schema,
    default_value: {},
    is_public: true,
    input: "localized_long_text",
  }),
};

export type SettingKey = keyof typeof SITE_SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SITE_SETTINGS)[K]["schema"]>;
export type SiteSettings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_KEYS = Object.keys(SITE_SETTINGS) as SettingKey[];

export function isSettingKey(value: string): value is SettingKey {
  return value in SITE_SETTINGS;
}

// A bad or missing row never breaks a page: it falls back to the default.
export function parseSetting<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> {
  const definition = SITE_SETTINGS[key];
  const result = definition.schema.safeParse(raw);
  return (result.success ? result.data : definition.default_value) as SettingValue<K>;
}

export function buildSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [
      key,
      stored.has(key) ? parseSetting(key, stored.get(key)) : SITE_SETTINGS[key].default_value,
    ]),
  ) as SiteSettings;
}

export function defaultSettings(): SiteSettings {
  return buildSettings([]);
}
