import type { ColumnType, Generated } from "kysely";

// Table types for Kysely, matching migrations.ts. Values read from SQLite come back as 0/1 for
// booleans and as text for JSON; rows are always mapped through bool()/json() from values.ts,
// so these types describe what is written.

type Timestamps = {
  id: string;
  created_at: Generated<string>;
  updated_at: Generated<string>;
};
type Bool = ColumnType<boolean | number, boolean | undefined, boolean>;
type Json = ColumnType<unknown, unknown, unknown>;
type Time = ColumnType<string | null, string | null | undefined, string | null>;
type Int = ColumnType<number, number | undefined, number>;
type Text = ColumnType<string, string | undefined, string>;

export type UsersTable = Timestamps & {
  email: string;
  name: Text;
  phone: Text;
  verified: Bool;
  accepts_marketing: Bool;
};
export type RolesTable = Timestamps & {
  name: string;
  description: Text;
  permissions: Json;
  is_system: Bool;
  is_read_only: Bool;
};
export type TeamMembersTable = Timestamps & {
  user_id: string;
  roles: Json;
  is_admin: Bool;
  is_active: Bool;
  locale: Text;
};
export type ActivityLogTable = Timestamps & {
  actor_id: string | null;
  action: string;
  target_type: Text;
  target_id: Text;
  details: Json;
  is_denied: Bool;
};
export type SiteSettingsTable = Timestamps & {
  key: string;
  category: Text;
  value: Json;
  description: Text;
  is_public: Bool;
  updated_by: string | null;
};
export type CategoriesTable = Timestamps & {
  name: Json;
  slug: string;
  description: Json;
  parent_id: string | null;
  image: Text;
  sort_order: Int;
  is_active: Bool;
  seo: Json;
};
export type ProductsTable = Timestamps & {
  title: Json;
  slug: string;
  description: Json;
  category_id: string | null;
  price: Int;
  compare_at_price: Int;
  status: Text;
  is_featured: Bool;
  tags: Json;
  deleted_at: Time;
  seo: Json;
  is_gift_card: Bool;
};
export type ProductImagesTable = Timestamps & { product_id: string; path: string; sort_order: Int; color: Text };
export type ProductVariantsTable = Timestamps & {
  product_id: string;
  size: Text;
  color: Text;
  color_hex: Text;
  sku: Text;
  price_override: Int;
  stock: Int;
  is_active: Bool;
  sort_order: Int;
};
export type AddressesTable = Timestamps & {
  user_id: string;
  full_name: string;
  phone: Text;
  line1: string;
  line2: Text;
  city: string;
  region: Text;
  postal_code: Text;
  country: string;
  is_default: Bool;
};
export type DiscountCodesTable = Timestamps & {
  code: string;
  type: string;
  value: Int;
  min_subtotal: Int;
  starts_at: Time;
  ends_at: Time;
  usage_limit: Int;
  used_count: Int;
  is_active: Bool;
  title: Text;
  applies_to: Json;
  once_per_customer: Bool;
  deleted_at: Time;
};
type TotalsColumns = {
  currency: Text;
  subtotal: Int;
  discount_total: Int;
  shipping_total: Int;
  tax_total: Int;
  cod_fee: Int;
  total: Int;
};
export type CheckoutSessionsTable = Timestamps &
  TotalsColumns & {
    user_id: string | null;
    email: Text;
    phone: Text;
    locale: Text;
    line_items: Json;
    discount_code_id: string | null;
    shipping_address: Json;
    billing_address: Json;
    shipping_method: Text;
    payment_method: Text;
    status: Text;
    attribution: Json;
    expires_at: string;
    customer_note: Text;
    contact_at: Time;
    recovery_sent_at: Time;
    gift_card_id: string | null;
    gift_card_amount: Int;
  };
export type OrdersTable = Timestamps &
  TotalsColumns & {
    order_number: number;
    user_id: string | null;
    email: string;
    phone: Text;
    locale: Text;
    status: Text;
    payment_status: Text;
    payment_method: Text;
    discount_code_id: string | null;
    shipping_address: Json;
    billing_address: Json;
    shipping_method: Text;
    customer_note: Text;
    internal_note: Text;
    attribution: Json;
    tracking_number: Text;
    carrier: Text;
    tracking_url: Text;
    checkout_session_id: string | null;
    paid_at: Time;
    shipped_at: Time;
    delivered_at: Time;
    cancelled_at: Time;
    deleted_at: Time;
    refunded_total: Int;
    gift_card_total: Int;
  };
export type OrderItemsTable = Timestamps & {
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_label: Text;
  sku: Text;
  image: Text;
  unit_price: Int;
  quantity: Int;
  line_total: Int;
};
export type OrderEventsTable = Timestamps & {
  order_id: string;
  type: string;
  from_status: Text;
  to_status: Text;
  message: Text;
  actor_id: string | null;
  is_customer_visible: Bool;
};
export type PaymentsTable = Timestamps & {
  order_id: string | null;
  checkout_session_id: string | null;
  provider: string;
  provider_ref: Text;
  amount: Int;
  currency: Text;
  status: string;
  error_code: Text;
  raw: Json;
};
export type ContactMessagesTable = Timestamps & {
  name: string;
  email: string;
  phone: Text;
  subject: Text;
  message: string;
  status: Text;
};

// Built-in auth (SQLite): see migration 0003_builtin_auth.
export type AuthCredentialsTable = { user_id: string; password_hash: string; updated_at: Generated<string> };
export type AuthSessionsTable = {
  token_hash: string;
  user_id: string;
  expires_at: string;
  created_at: Generated<string>;
};
export type AuthTokensTable = {
  token_hash: string;
  user_id: string;
  purpose: string;
  expires_at: string;
  used_at: string | null;
  created_at: Generated<string>;
};

export type CustomerNotesTable = Timestamps & { customer_key: string; note: Text; updated_by: string | null };
export type SavedViewsTable = Timestamps & { user_id: string; resource: string; name: string; filters: Json };

export type DomainsTable = Timestamps & {
  hostname: string;
  target: string;
  is_primary: Bool;
  status: Text;
  dns_records: Json;
  provider_ref: Text;
  last_error: Text;
  last_checked_at: Time;
};

export type ThemesTable = Timestamps & {
  name: string;
  template: string;
  draft: Json;
  published: Json;
  history: Json;
  is_live: Bool;
  published_at: Time;
};

export type PagesTable = Timestamps & {
  title: Json;
  slug: string;
  sections: Json;
  seo: Json;
  is_published: Bool;
};

export type MediaTable = Timestamps & {
  path: string;
  name: string;
  size: number;
};

export type EmailLogTable = Timestamps & {
  template: string;
  recipient: string;
  subject: Text;
  status: string;
  error: Text;
  order_id: string | null;
};

export type InventoryAdjustmentsTable = Timestamps & {
  variant_id: string | null;
  delta: number;
  stock_after: number;
  reason: string;
  note: Text;
  actor_id: string | null;
};

export type DraftOrdersTable = Timestamps & {
  draft_number: number;
  status: Text;
  user_id: string | null;
  email: Text;
  customer_name: Text;
  phone: Text;
  locale: Text;
  lines: Json;
  shipping_address: Json;
  shipping_method: Text;
  shipping_price: number | null;
  discount: Json;
  note: Text;
  order_id: string | null;
  checkout_session_id: string | null;
  created_by: string | null;
  total: Int;
  currency: Text;
};

export type RefundsTable = Timestamps & {
  order_id: string;
  amount: number;
  lines: Json;
  reason: Text;
  restocked: Bool;
  provider_ref: Text;
  actor_id: string | null;
};

export type CollectionsTable = Timestamps & {
  title: Json;
  slug: string;
  description: Json;
  image_url: Text;
  kind: Text;
  rules: Json;
  sort: Text;
  is_published: Bool;
  seo: Json;
  sort_order: Int;
};

export type CollectionProductsTable = Timestamps & {
  collection_id: string;
  product_id: string;
  position: Int;
};

export type GiftCardsTable = Timestamps & {
  code: string;
  initial_value: number;
  balance: number;
  currency: Text;
  expires_at: Time;
  is_active: Bool;
  customer_email: Text;
  note: Text;
  order_id: string | null;
  created_by: string | null;
};

export type GiftCardTransactionsTable = Timestamps & {
  gift_card_id: string;
  amount: number;
  order_id: string | null;
  note: Text;
};

export type ReviewsTable = Timestamps & {
  product_id: string;
  user_id: string;
  email: Text;
  rating: number;
  title: Text;
  body: string;
  author_name: string;
  locale: Text;
  status: Text;
  reply: Text;
};

export type WishlistItemsTable = Timestamps & { user_id: string; product_id: string };

export type ApiKeysTable = Timestamps & {
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: Time;
  revoked_at: Time;
};

export type Database = {
  users: UsersTable;
  roles: RolesTable;
  team_members: TeamMembersTable;
  activity_log: ActivityLogTable;
  site_settings: SiteSettingsTable;
  categories: CategoriesTable;
  products: ProductsTable;
  product_images: ProductImagesTable;
  product_variants: ProductVariantsTable;
  addresses: AddressesTable;
  discount_codes: DiscountCodesTable;
  checkout_sessions: CheckoutSessionsTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  order_events: OrderEventsTable;
  payments: PaymentsTable;
  contact_messages: ContactMessagesTable;
  customer_notes: CustomerNotesTable;
  saved_views: SavedViewsTable;
  domains: DomainsTable;
  themes: ThemesTable;
  pages: PagesTable;
  media: MediaTable;
  email_log: EmailLogTable;
  inventory_adjustments: InventoryAdjustmentsTable;
  draft_orders: DraftOrdersTable;
  refunds: RefundsTable;
  collections: CollectionsTable;
  collection_products: CollectionProductsTable;
  gift_cards: GiftCardsTable;
  gift_card_transactions: GiftCardTransactionsTable;
  reviews: ReviewsTable;
  wishlist_items: WishlistItemsTable;
  api_keys: ApiKeysTable;
  auth_credentials: AuthCredentialsTable;
  auth_sessions: AuthSessionsTable;
  auth_tokens: AuthTokensTable;
};
