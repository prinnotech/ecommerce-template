import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { localized_text_schema } from "@repo/core/lib/localized";
import { COUNTRY_CODES } from "@repo/core/lib/locale/countries";
import { hostname_schema } from "@repo/core/lib/schemas/domains";
import { DEFAULT_NAVIGATION, navigation_schema } from "@repo/core/lib/schemas/navigation";
import { DEFAULT_NOTIFICATIONS, DEFAULT_SMTP, notifications_schema, smtp_schema } from "@repo/core/lib/email/templates";
import {
  DEFAULT_PAYMENT_METHODS,
  payment_methods_schema,
  paymentMethodsFromLegacy,
} from "@repo/core/lib/schemas/payments";

// The site settings contract (style guide §12). Adding a setting:
// 1. add an entry here, 2. add its label under settings.items.<lowercase_key> in en/es/it, 3. read it.
// No migration is needed: missing or invalid stored values fall back to `default_value`.

export type SettingCategory =
  | "general"
  | "storefront"
  | "contact"
  | "localization"
  | "shipping"
  | "taxes"
  | "payments"
  | "content"
  // Written by Settings → Domains (not shown as fields): the proxies read them to redirect.
  | "domains"
  // Written by the theme editor's Navigation tab (not shown in Settings).
  | "navigation"
  // Settings → Email sending and Settings → Notifications have their own screens.
  | "email"
  | "notifications"
  // Products → Inventory.
  | "inventory"
  // Settings → Tracking (own screen; the Meta CAPI token is an encrypted secret).
  | "tracking";

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
  | "shipping_rates"
  | "shipping_zones"
  | "asset";

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

// Settings → Tracking. Empty = that tag is off.
export const tracking_schema = z.object({
  gtm_id: z.union([z.string().regex(/^GTM-[A-Z0-9]{4,12}$/), z.literal("")]),
  google_tag_id: z.union([z.string().regex(/^(G|AW)-[A-Z0-9]{4,14}$/), z.literal("")]),
  // "AW-123456789/AbCdEf" from Google Ads → Conversions.
  google_ads_conversion: z.union([z.string().regex(/^AW-\d{6,14}\/[A-Za-z0-9_-]{4,40}$/), z.literal("")]),
  meta_pixel_id: z.union([z.string().regex(/^\d{8,20}$/), z.literal("")]),
});
export type TrackingSettings = z.infer<typeof tracking_schema>;
export const EMPTY_TRACKING: TrackingSettings = {
  gtm_id: "",
  google_tag_id: "",
  google_ads_conversion: "",
  meta_pixel_id: "",
};

export const shipping_rate_schema = z.object({
  id: z.string().min(1).max(50),
  name: localized_text_schema,
  price: cents_schema,
  min_days: z.number().int().min(0),
  max_days: z.number().int().min(0),
});
export type ShippingRate = z.infer<typeof shipping_rate_schema>;

// A group of countries with its own rates and, optionally, its own tax rate (null = TAX_RATE).
export const shipping_zone_schema = z.object({
  id: z.string().min(1).max(50),
  name: localized_text_schema,
  countries: z.array(z.enum(COUNTRY_CODES)).min(1).max(300),
  rates: z.array(shipping_rate_schema).min(1).max(20),
  tax_rate: z.number().min(0).max(100).nullable(),
});
export type ShippingZone = z.infer<typeof shipping_zone_schema>;

// A country belongs to one zone at most; rate ids are unique across zones and the default rates.
export const shipping_zones_schema = z
  .array(shipping_zone_schema)
  .max(50)
  .refine((zones) => {
    const countries = zones.flatMap((zone) => zone.countries);
    return new Set(countries).size === countries.length;
  }, "duplicate_country")
  .refine((zones) => {
    const ids = zones.flatMap((zone) => zone.rates.map((rate) => rate.id));
    return new Set(ids).size === ids.length;
  }, "duplicate_rate");

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
    input: "asset",
  }),
  SITE_FAVICON_URL: setting({
    category: "general",
    schema: z.union([z.url(), z.literal("")]),
    default_value: "",
    is_public: true,
    input: "asset",
  }),
  // Primary domains (Settings → Domains). Public: each app's proxy reads its own to redirect
  // every other hostname there. "" = no redirect.
  PRIMARY_DOMAIN_STORE: setting({
    category: "domains",
    schema: z.union([hostname_schema, z.literal("")]),
    default_value: "",
    is_public: true,
    input: "text",
  }),
  PRIMARY_DOMAIN_ADMIN: setting({
    category: "domains",
    schema: z.union([hostname_schema, z.literal("")]),
    default_value: "",
    is_public: true,
    input: "text",
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
  // Countries with their own rates and tax (Settings → Shipping). SHIPPING_RATES cover the rest.
  SHIPPING_ZONES: setting({
    category: "shipping",
    schema: shipping_zones_schema,
    default_value: [],
    is_public: true,
    input: "shipping_zones",
  }),
  // On: only countries in a zone can order.
  SHIP_ONLY_TO_ZONES: setting({
    category: "shipping",
    schema: z.boolean(),
    default_value: false,
    is_public: true,
    input: "boolean",
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
    category: "taxes",
    // Percent, e.g. 22 for 22%.
    schema: z.number().min(0).max(100),
    default_value: 0,
    is_public: true,
    input: "number",
  }),
  TAX_INCLUDED: setting({
    category: "taxes",
    schema: z.boolean(),
    default_value: true,
    is_public: true,
    input: "boolean",
  }),

  // Payments (Settings → Payments has its own screen). The Stripe secret key and webhook secret
  // are encrypted secrets (lib/secrets.ts), not settings.
  PAYMENT_METHODS: setting({
    category: "payments",
    schema: payment_methods_schema,
    default_value: DEFAULT_PAYMENT_METHODS,
    is_public: true,
    input: "json",
  }),
  // Safe in the browser: the card form loads Stripe with it.
  STRIPE_PUBLISHABLE_KEY: setting({
    category: "payments",
    schema: z.union([z.string().regex(/^pk_(test|live)_[A-Za-z0-9]+$/), z.literal("")]),
    default_value: "",
    is_public: true,
    input: "text",
  }),

  // Ad tracking ids (public: the store's pages load the tags with them, after cookie consent).
  TRACKING: setting({
    category: "tracking",
    schema: tracking_schema,
    default_value: EMPTY_TRACKING,
    is_public: true,
    input: "object",
  }),

  // Storefront (home page and conversion messages)
  // Email sending (the password is an encrypted secret, lib/secrets.ts). Server only.
  SMTP: setting({
    category: "email",
    schema: smtp_schema,
    default_value: DEFAULT_SMTP,
    is_public: false,
    input: "json",
  }),
  // Which emails go out, their text per language, and the staff addresses for new orders.
  NOTIFICATIONS: setting({
    category: "notifications",
    schema: notifications_schema,
    default_value: DEFAULT_NOTIFICATIONS,
    is_public: false,
    input: "json",
  }),
  // Variants at or below this stock show as "low stock" (Products → Inventory, the dashboard).
  LOW_STOCK_THRESHOLD: setting({
    category: "inventory",
    schema: z.number().int().min(0).max(10_000),
    default_value: 5,
    is_public: false,
    input: "number",
  }),
  // Header menu and footer (Online store → Themes → Customize → Navigation).
  NAVIGATION: setting({
    category: "navigation",
    schema: navigation_schema,
    default_value: DEFAULT_NAVIGATION,
    is_public: true,
    input: "json",
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
  // Stores from before payment methods were a list: convert { card, cash_on_delivery } + COD_FEE.
  const legacy_payments = paymentMethodsFromLegacy(stored.get("PAYMENT_METHODS"), stored.get("COD_FEE"));
  if (legacy_payments) stored.set("PAYMENT_METHODS", legacy_payments);
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
