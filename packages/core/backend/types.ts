// The backend contract: everything the apps need from a database, auth and file storage.
// Each backend (PocketBase, Supabase, SQLite) implements it; apps and actions only use it,
// through getBackend(). Expected failures throw BackendError with an ErrorCode.
//
// Rules for implementations:
// - Methods trust their arguments: permissions and validation happen in the actions first.
// - Returned data is plain JSON (no SDK records), with file URLs already resolved.
// - Ids are opaque strings.

import type { PricedLine } from "@repo/core/lib/checkout/checkout-server";
import type { PricingDiscount } from "@repo/core/lib/checkout/pricing";
import type { LocalizedText } from "@repo/core/lib/localized";
import type {
  OrderEventType,
  OrderStatus,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentStatus,
} from "@repo/core/lib/orders";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import type { Seo } from "@repo/core/lib/schemas/seo";
import type { AdjustmentReason, InventoryFilters } from "@repo/core/lib/schemas/inventory";
import type { DraftDiscount, DraftListFilters, DraftStatus } from "@repo/core/lib/schemas/draft-orders";
import type { DiscountAppliesTo, DiscountInput, DiscountListFilters } from "@repo/core/lib/schemas/discounts";
import type { AbandonedCheckoutFilters } from "@repo/core/lib/schemas/abandoned-checkouts";
import type {
  CategoryInput,
  ProductInput,
  ProductListFilters,
  ProductStatus,
  VariantInput,
} from "@repo/core/lib/schemas/catalog";
import type { ImportCategory, ImportProduct } from "@repo/core/lib/schemas/catalog-import";
import type { ActivityFilters, SiteAssetKind } from "@repo/core/lib/schemas/admin";
import type { MessageStatus } from "@repo/core/lib/schemas/contact";
import type { DomainStatus, DomainTarget } from "@repo/core/lib/schemas/domains";
import type { OrderListFilters } from "@repo/core/lib/schemas/orders";
import type { ShopFilters } from "@repo/core/lib/schemas/storefront";
import type { Attribution } from "@repo/core/lib/tracking/attribution";
import type { CollectionInput, ProductFacts } from "@repo/core/lib/schemas/collections";
import type { GiftCardFilters } from "@repo/core/lib/schemas/gift-cards";
import type { ReviewFilters, ReviewInput, ReviewStatus } from "@repo/core/lib/schemas/reviews";

// ---------- Auth (the visitor of the current request) ----------

export type SessionUser = { id: string; email: string; name: string; phone: string; verified: boolean };

export type AuthBackend = {
  // Verified against the backend (never from the cookie alone). null = signed out.
  getCurrentUser(): Promise<SessionUser | null>;
  // These set or clear the session cookie, so call them only from actions.
  signIn(email: string, password: string): Promise<void>; // invalid_credentials
  signUp(input: { name: string; email: string; password: string }): Promise<void>; // email_taken
  signOut(): Promise<void>;
  // Sends the reset email; never reveals whether the account exists.
  requestPasswordReset(email: string): Promise<void>;
  confirmPasswordReset(token: string, password: string): Promise<void>; // invalid_token
  // Staff invites (admin only, after authorization). Returns the user id; creates the account without
  // a usable password when the email is new. `is_new` = the account was created now.
  ensureUser(input: { email: string; name: string }): Promise<{ user_id: string; is_new: boolean }>;
  // Emails a link to set a password, landing on the admin's /new-password page where the backend allows it.
  sendStaffInvite(email: string): Promise<void>;
};

// ---------- Staff access ----------

export type StaffMembership = { is_admin: boolean; is_active: boolean; roles: string[]; locale: string };
export type StaffRole = { name: string; permissions: unknown[]; is_read_only: boolean };

// A role as the Roles screen shows it.
export type AdminRole = {
  id: string;
  name: string;
  description: string;
  permissions: unknown[];
  is_system: boolean;
  is_read_only: boolean;
  member_count: number;
};

export type StaffMember = {
  user_id: string;
  email: string;
  name: string;
  roles: string[];
  is_admin: boolean;
  is_active: boolean;
  locale: string;
  created_at: string;
};

export type StaffBackend = {
  getMembership(user_id: string): Promise<StaffMembership | null>;
  getRoles(): Promise<StaffRole[]>;
  setLocale(user_id: string, locale: string): Promise<void>; // not_found

  listMembers(): Promise<StaffMember[]>;
  // Creates the team_members row for an existing user.
  addMember(user_id: string, fields: { roles: string[]; is_admin: boolean }): Promise<void>; // member_exists
  updateMember(
    user_id: string,
    fields: Partial<{ roles: string[]; is_admin: boolean; is_active: boolean }>,
  ): Promise<void>; // not_found

  listRoles(): Promise<AdminRole[]>;
  createRole(fields: { name: string; description: string; permissions: string[] }): Promise<{ id: string }>; // role_name_taken
  // Roles are addressed by their unique name (seeded SQL roles have readable ids, not record ids).
  updateRole(name: string, fields: { description: string; permissions: string[] }): Promise<void>; // not_found
  // System roles and roles still assigned to someone can't be deleted.
  deleteRole(name: string): Promise<void>; // not_found, system_role, role_in_use
};

// ---------- Domains (Settings → Domains) ----------

// A DNS record the owner creates at their registrar: type (CNAME, A, ALIAS, TXT), the name
// (host) relative to the domain's zone or its full name, and the value.
export type DnsRecord = { type: string; name: string; value: string };

export type AdminDomain = {
  id: string;
  hostname: string;
  target: DomainTarget;
  is_primary: boolean;
  status: DomainStatus;
  dns_records: DnsRecord[];
  // The hosting provider's id for the domain ("" in manual mode).
  provider_ref: string;
  last_error: string;
  last_checked_at: string;
  created_at: string;
};

export type DomainsBackend = {
  list(): Promise<AdminDomain[]>;
  get(id: string): Promise<AdminDomain | null>;
  create(
    fields: Pick<AdminDomain, "hostname" | "target" | "status" | "dns_records" | "provider_ref" | "last_error">,
  ): Promise<AdminDomain>; // domain_taken
  update(
    id: string,
    fields: Partial<Pick<AdminDomain, "status" | "dns_records" | "provider_ref" | "last_error" | "last_checked_at">>,
  ): Promise<void>; // not_found
  // Makes this domain the only primary one of its target (store or admin).
  setPrimary(id: string): Promise<void>; // not_found
  // No primary for this target any more (its other addresses stop redirecting).
  clearPrimary(target: DomainTarget): Promise<void>;
  remove(id: string): Promise<void>; // not_found
};

// ---------- Themes (Online store → Themes) ----------

// Theme JSON is stored as-is; core validates it (parseThemeData) so every backend behaves the same.
export type ThemeVersion = { published_at: string; data: unknown };

export type ThemeRecord = {
  id: string;
  name: string;
  // The template it started from (packages/core/themes).
  template: string;
  draft: unknown;
  // null until the theme is published for the first time.
  published: unknown;
  // Newest first, at most THEME_HISTORY_SIZE.
  history: ThemeVersion[];
  is_live: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type ThemesBackend = {
  list(): Promise<ThemeRecord[]>;
  get(id: string): Promise<ThemeRecord | null>;
  // The live theme, for the storefront. null when no theme is live (the default template is used).
  getLive(): Promise<Pick<ThemeRecord, "template" | "published"> | null>;
  create(fields: Pick<ThemeRecord, "name" | "template" | "draft">): Promise<ThemeRecord>;
  update(
    id: string,
    fields: Partial<Pick<ThemeRecord, "name" | "draft" | "published" | "history" | "published_at">>,
  ): Promise<void>; // not_found
  // Makes this theme the only live one.
  setLive(id: string): Promise<void>; // not_found
  remove(id: string): Promise<void>; // not_found
};

// ---------- Custom pages (Online store → Pages) ----------

// Sections and SEO are stored as JSON and validated in core (parsePage), like themes.
export type PageRecord = {
  id: string;
  title: unknown;
  slug: string;
  sections: unknown;
  seo: unknown;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type PagesBackend = {
  list(): Promise<PageRecord[]>;
  get(id: string): Promise<PageRecord | null>;
  // Published pages only (the storefront).
  getPublishedBySlug(slug: string): Promise<PageRecord | null>;
  create(fields: Pick<PageRecord, "title" | "slug" | "sections" | "seo">): Promise<PageRecord>; // slug_taken
  update(
    id: string,
    fields: Partial<Pick<PageRecord, "title" | "slug" | "sections" | "seo" | "is_published">>,
  ): Promise<void>; // not_found, slug_taken
  remove(id: string): Promise<void>; // not_found
};

// ---------- Media library (images uploaded from the theme editor) ----------

export type MediaItem = { id: string; url: string; name: string; size: number; created_at: string };

export type MediaBackend = {
  list(): Promise<MediaItem[]>;
  upload(file: File): Promise<MediaItem>;
  remove(id: string): Promise<void>; // not_found
};

// ---------- Email log (Settings → Notifications) ----------

export type EmailLogStatus = "sent" | "failed" | "skipped";

export type EmailLogEntry = {
  id: string;
  created_at: string;
  template: string;
  recipient: string;
  subject: string;
  status: EmailLogStatus;
  error: string;
  order_id: string;
};

export type EmailLogBackend = {
  log(entry: Omit<EmailLogEntry, "id" | "created_at">): Promise<void>;
  list(page: number, page_size: number): Promise<Page<EmailLogEntry>>;
};

// ---------- Inventory (Products → Inventory) ----------

export type InventoryRow = {
  variant_id: string;
  product_id: string;
  product_title: LocalizedText;
  image_url: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  is_active: boolean;
};

export type InventoryAdjustmentEntry = {
  id: string;
  created_at: string;
  delta: number;
  stock_after: number;
  reason: AdjustmentReason;
  note: string;
  // Empty for changes made by the system (orders).
  actor_name: string;
};

export type InventoryBackend = {
  // Variants of products that aren't deleted, by product then variant order.
  list(filters: InventoryFilters, low_stock_threshold: number, page_size: number): Promise<Page<InventoryRow>>;
  // Sets or changes the stock and logs it, in one step. Stock never goes below 0.
  adjust(
    variant_id: string,
    change: { mode: "set" | "add"; quantity: number; reason: AdjustmentReason; note: string; actor_id: string },
  ): Promise<{ stock_before: number; stock_after: number }>; // not_found
  history(variant_id: string, limit: number): Promise<InventoryAdjustmentEntry[]>;
};

// ---------- Draft orders (Orders → Drafts) ----------

// What's saved: variant lines keep only the id and quantity (priced when read), custom lines
// keep their title and price.
export type DraftLine = { variant_id: string; title: string; unit_price: number; quantity: number };

export type DraftOrder = {
  id: string;
  draft_number: number;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
  user_id: string;
  email: string;
  customer_name: string;
  phone: string;
  locale: string;
  lines: DraftLine[];
  shipping_address: AddressFields | null;
  shipping_method: string;
  shipping_price: number | null;
  discount: DraftDiscount | null;
  note: string;
  order_id: string;
  checkout_session_id: string;
  // Saved with the draft, for the list.
  total: number;
  currency: string;
};

export type DraftOrderRow = Pick<
  DraftOrder,
  "id" | "draft_number" | "status" | "created_at" | "customer_name" | "email" | "total" | "currency" | "order_id"
>;

export type DraftOrderFields = Omit<
  DraftOrder,
  "id" | "draft_number" | "status" | "created_at" | "updated_at" | "order_id" | "checkout_session_id"
>;

export type DraftOrdersBackend = {
  list(filters: DraftListFilters, page_size: number): Promise<Page<DraftOrderRow>>;
  get(id: string): Promise<DraftOrder>; // not_found
  // Numbers drafts D1, D2, … in order.
  create(fields: DraftOrderFields, created_by: string): Promise<{ id: string }>;
  update(id: string, fields: DraftOrderFields): Promise<void>; // not_found
  delete(id: string): Promise<void>; // not_found
  // The checkout session the invoice link opens; the status becomes invoice_sent.
  setInvoiceSession(id: string, checkout_session_id: string): Promise<void>;
  bySession(checkout_session_id: string): Promise<DraftOrder | null>;
  complete(id: string, order_id: string): Promise<void>;
};

// ---------- Discounts (Marketing → Discounts) ----------

export type AdminDiscount = DiscountCode & { created_at: string; updated_at: string };

export type DiscountTarget = { id: string; name: LocalizedText };

export type DiscountsBackend = {
  // Not deleted. Status filters use the same rules as discountStatus() (lib/schemas/discounts.ts).
  list(filters: DiscountListFilters, page_size: number, now: string): Promise<Page<AdminDiscount>>;
  get(id: string): Promise<AdminDiscount>; // not_found
  create(input: DiscountInput): Promise<{ id: string }>; // code_taken
  update(id: string, input: DiscountInput): Promise<void>; // code_taken, not_found
  // Soft delete: past orders keep pointing at it; the code can't be used again.
  delete(id: string): Promise<void>; // not_found
  // Names of the products or categories a discount is limited to, for the editor.
  targets(applies_to: DiscountAppliesTo): Promise<DiscountTarget[]>;
  // Live products in these categories (for "applies to categories").
  productIdsInCategories(category_ids: string[]): Promise<string[]>;
  // Orders (not cancelled) placed with this discount by this email.
  usesByEmail(discount_id: string, email: string): Promise<number>;
};

// ---------- Abandoned checkouts (Orders → Abandoned checkouts) ----------

export type AbandonedCheckoutRow = {
  id: string;
  email: string;
  locale: string;
  currency: string;
  total: number;
  item_count: number;
  // First item titles, for the list.
  items: string[];
  created_at: string;
  contact_at: string;
  recovery_sent_at: string;
};

export type AbandonedCheckoutsBackend = {
  // The customer typed their email: the session can be recovered from now on.
  saveContact(session_id: string, email: string): Promise<void>;
  // Sessions with an email, not completed, whose email was typed before `contact_before`.
  list(
    filters: AbandonedCheckoutFilters,
    page_size: number,
    contact_before: string,
  ): Promise<Page<AbandonedCheckoutRow>>;
  // For the automatic email: no recovery sent yet, email typed between the two times.
  due(contact_before: string, contact_after: string, limit: number): Promise<string[]>;
  // The session reopens until `expires_at`, so the link in the email works.
  markRecoverySent(session_id: string, expires_at: string): Promise<void>;
  recoverySentAt(session_id: string): Promise<string>;
};

// ---------- Collections (Products → Collections) ----------

export type AdminCollection = CollectionInput & {
  id: string;
  sort_order: number;
  // Products picked by hand (manual collections).
  product_ids: string[];
  created_at: string;
  updated_at: string;
};

export type CollectionsBackend = {
  list(): Promise<AdminCollection[]>;
  get(id: string): Promise<AdminCollection>; // not_found
  create(input: CollectionInput): Promise<{ id: string }>; // slug_taken
  update(id: string, input: CollectionInput): Promise<void>; // slug_taken, not_found
  delete(id: string): Promise<void>; // not_found
  // A manual collection's products, in this order.
  setProducts(id: string, product_ids: string[]): Promise<void>; // not_found
  // Published only (the store).
  published(slug: string): Promise<AdminCollection | null>;
  publishedById(id: string): Promise<AdminCollection | null>;
  publishedSlugs(): Promise<{ slug: string; updated_at: string }[]>;
};

// ---------- Gift cards (Products → Gift cards) ----------

export type GiftCard = {
  id: string;
  code: string;
  initial_value: number;
  balance: number;
  currency: string;
  expires_at: string;
  is_active: boolean;
  customer_email: string;
  note: string;
  // The order that bought it ("" = issued by staff).
  order_id: string;
  created_at: string;
};

export type GiftCardTransaction = {
  id: string;
  created_at: string;
  // Negative = spent, positive = issued or given back.
  amount: number;
  order_id: string;
  note: string;
};

export type GiftCardsBackend = {
  list(filters: GiftCardFilters, page_size: number, now: string): Promise<Page<GiftCard>>;
  get(id: string): Promise<GiftCard & { transactions: GiftCardTransaction[] }>; // not_found
  // Codes are stored normalized (no dashes, upper case).
  findByCode(code: string): Promise<GiftCard | null>;
  issue(card: {
    code: string;
    amount: number;
    currency: string;
    expires_at: string;
    customer_email: string;
    note: string;
    order_id: string;
    created_by: string;
  }): Promise<{ id: string }>; // code_taken
  setActive(id: string, is_active: boolean): Promise<void>; // not_found
  // Takes `amount` off the balance only if it's still there (two checkouts can't spend it twice).
  redeem(id: string, amount: number, ref: { order_id: string; note: string }): Promise<boolean>;
  credit(id: string, amount: number, ref: { order_id: string; note: string }): Promise<void>;
  countForOrder(order_id: string): Promise<number>;
};

// ---------- Product reviews (Products → Reviews) ----------

export type Review = {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  body: string;
  author_name: string;
  status: ReviewStatus;
  reply: string;
  created_at: string;
};

export type AdminReview = Review & { product_title: LocalizedText; email: string };

export type ReviewSummary = { average: number; count: number };

export type ReviewsBackend = {
  list(filters: ReviewFilters, page_size: number): Promise<Page<AdminReview>>;
  // Approved reviews of a product, newest first.
  approved(product_id: string, page: number, page_size: number): Promise<Page<Review>>;
  summary(product_id: string): Promise<ReviewSummary>;
  // The customer's own review of a product (any status), if any.
  mine(user_id: string, product_id: string): Promise<Review | null>;
  // A non-cancelled order of this customer contains the product.
  hasPurchased(user_id: string, product_id: string): Promise<boolean>;
  create(review: ReviewInput & { user_id: string; email: string; locale: string }): Promise<{ id: string }>; // review_exists
  setStatus(id: string, status: ReviewStatus): Promise<void>; // not_found
  reply(id: string, reply: string): Promise<void>; // not_found
  delete(id: string): Promise<void>; // not_found
};

// ---------- Wishlist (customer account) ----------

export type WishlistBackend = {
  // Product ids, most recently added first.
  list(user_id: string): Promise<string[]>;
  add(user_id: string, product_ids: string[]): Promise<void>;
  remove(user_id: string, product_id: string): Promise<void>;
};

// ---------- API keys (the MCP server) ----------

// A key as Settings → API keys lists it. The key itself is shown once, when it is created; only its
// SHA-256 hash is stored.
export type ApiKey = {
  id: string;
  name: string;
  // The first characters, so staff can tell keys apart.
  key_prefix: string;
  user_id: string;
  user_email: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type ApiKeysBackend = {
  list(): Promise<ApiKey[]>;
  create(input: { user_id: string; name: string; key_prefix: string; key_hash: string }): Promise<{ id: string }>;
  revoke(id: string): Promise<void>; // not_found
  // A key that is not revoked, with the account it acts as.
  findActive(key_hash: string): Promise<{ id: string; user: SessionUser } | null>;
  touch(id: string): Promise<void>;
};

// ---------- Saved index-table views (per staff member) ----------

export type SavedView = { id: string; resource: string; name: string; filters: Record<string, string> };

export type SavedViewsBackend = {
  list(user_id: string, resource: string): Promise<SavedView[]>;
  create(user_id: string, view: Omit<SavedView, "id">): Promise<SavedView>;
  remove(user_id: string, id: string): Promise<void>; // not_found (also for another member's view)
};

// ---------- Activity log ----------

export type ActivityEntry = {
  actor_id: string | null;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  is_denied?: boolean;
};

export type ActivityRow = {
  id: string;
  created_at: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  is_denied: boolean;
};

export type ActivityBackend = {
  log(entry: ActivityEntry): Promise<void>;
  // Newest first.
  list(filters: ActivityFilters, page_size: number): Promise<Page<ActivityRow>>;
};

// ---------- Site settings (key/value) ----------

export type StoredSetting = { key: string; value: unknown; updated_at: string };

export type SettingsBackend = {
  list(): Promise<StoredSetting[]>;
  get(key: string): Promise<StoredSetting | null>;
  // Insert or update one key; returns the previous value (null if none).
  save(row: {
    key: string;
    category: string;
    value: unknown;
    is_public: boolean;
    updated_by: string;
  }): Promise<unknown>;
  // Deletes the key so the default applies again; returns the previous value, or undefined if none was stored.
  remove(key: string): Promise<unknown>;
  // Backends that send their own emails use the store name there (PocketBase's appName).
  syncStoreName(name: string): Promise<void>;
  // Stores the logo or favicon file and returns its public URL (saved in a setting by the action).
  uploadAsset(kind: SiteAssetKind, file: File): Promise<string>;
};

// ---------- Contact messages ----------

export type InboxMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
};

export type Page<T> = { items: T[]; page: number; total_pages: number; total_items: number };

export type MessagesBackend = {
  create(message: { name: string; email: string; phone: string; subject: string; message: string }): Promise<void>;
  // status "inbox" = everything not archived.
  list(filters: { status: "inbox" | MessageStatus; page: number }, page_size: number): Promise<Page<InboxMessage>>;
  setStatus(id: string, status: MessageStatus): Promise<void>; // not_found
  // Bulk version; unknown ids are skipped. Returns how many changed.
  setStatusMany(ids: string[], status: MessageStatus): Promise<number>;
  countUnread(): Promise<number>;
};

// ---------- Storefront (public reads: only active products, active variants, visible categories) ----------

export type StoreColor = { name: string; hex: string };

export type StoreProductCard = {
  id: string;
  slug: string;
  title: LocalizedText;
  image: string;
  hover_image: string;
  // Lowest sellable price (a variant can override the product price).
  price: number;
  has_price_range: boolean;
  compare_at_price: number;
  colors: StoreColor[];
  is_sold_out: boolean;
  created_at: string;
  // Added recently ("New" badge).
  is_new: boolean;
};

export type StoreCategory = {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  image_url: string;
  parent: string;
  seo: Seo;
};

export type StoreVariant = { id: string; size: string; color: string; color_hex: string; price: number; stock: number };

export type StoreProduct = {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  images: string[];
  price: number;
  compare_at_price: number;
  category: StoreCategory | null;
  variants: StoreVariant[];
  updated_at: string;
  seo: Seo;
};

export type ShopFacets = { sizes: string[]; colors: StoreColor[] };

export type ProductListQuery = {
  sort: "featured" | "newest";
  limit: number;
  featured_only?: boolean;
  exclude_id?: string;
  category_id?: string;
};

export type StorefrontBackend = {
  shopProducts(filters: ShopFilters, page_size: number): Promise<Page<StoreProductCard>>;
  productCards(query: ProductListQuery): Promise<StoreProductCard[]>;
  categories(): Promise<StoreCategory[]>;
  // Sizes and colors that exist on sellable variants, for the shop filters.
  facets(): Promise<ShopFacets>;
  product(slug: string): Promise<StoreProduct>; // not_found
  productSlugs(): Promise<{ slug: string; updated_at: string }[]>;
  // Every live product, with what collection rules look at (lib/schemas/collections.ts).
  productFacts(): Promise<ProductFacts[]>;
  // Cards of live products, in the order of `ids` (unknown or hidden ids are skipped).
  productCardsByIds(ids: string[]): Promise<StoreProductCard[]>;
};

// ---------- Catalog admin ----------

export type AdminCategory = {
  id: string;
  name: LocalizedText;
  slug: string;
  description: LocalizedText;
  parent: string;
  sort_order: number;
  is_active: boolean;
  image_url: string;
  product_count: number;
  seo: Seo;
};

// Validated by category_schema; the slug is lower-cased.
export type CategoryFields = CategoryInput;

export type AdminProductRow = {
  id: string;
  title: LocalizedText;
  slug: string;
  status: ProductStatus;
  price: number;
  compare_at_price: number;
  category_id: string;
  image_url: string;
  variant_count: number;
  total_stock: number;
  updated_at: string;
};

// `name` identifies the image inside the backend (file name or storage path).
// `color` = the variant color it shows ("" = every color).
export type AdminProductImage = { name: string; url: string; color: string };

export type AdminVariant = {
  id: string;
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  price_override: number;
  stock: number;
  is_active: boolean;
  sort_order: number;
};

export type AdminProduct = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  slug: string;
  category: string;
  price: number;
  compare_at_price: number;
  status: ProductStatus;
  is_featured: boolean;
  is_gift_card: boolean;
  tags: string[];
  seo: Seo;
  images: AdminProductImage[];
  variants: AdminVariant[];
  created_at: string;
  updated_at: string;
};

export type ImportOutcome = "created" | "updated" | "skipped" | "failed";
// Keys of dictionary.catalog.import.reasons.
export type ImportReason = "exists" | "sku_taken" | "category_forbidden" | "images_failed" | "generic";
export type ImportItemResult = { handle: string; outcome: ImportOutcome; reason?: ImportReason; images?: number };

export type CatalogBackend = {
  listCategories(): Promise<AdminCategory[]>;
  createCategory(fields: CategoryFields): Promise<{ id: string }>; // slug_taken
  updateCategory(id: string, fields: CategoryFields): Promise<void>; // slug_taken, not_found
  // Refused while products (not deleted) or subcategories still use it.
  deleteCategory(id: string): Promise<void>; // category_in_use, not_found
  setCategoryImage(id: string, file: File): Promise<{ image_url: string }>; // not_found
  removeCategoryImage(id: string): Promise<void>; // not_found

  listProducts(filters: ProductListFilters, page_size: number): Promise<Page<AdminProductRow>>;
  getProduct(id: string): Promise<AdminProduct>; // not_found (also for soft-deleted)
  createProduct(fields: ProductInput): Promise<{ id: string; slug: string }>; // slug_taken
  // Returns the status and price before the change, for the activity log.
  updateProduct(id: string, fields: ProductInput): Promise<{ status: ProductStatus; price: number }>; // slug_taken, not_found
  // Soft delete: past orders still point at the product.
  deleteProduct(id: string): Promise<void>; // not_found
  // Bulk edits from the products list; unknown or deleted ids are skipped. Each returns how many changed.
  setProductsStatus(ids: string[], status: ProductStatus): Promise<number>;
  setProductsCategory(ids: string[], category_id: string): Promise<number>;
  deleteProducts(ids: string[]): Promise<number>;
  // Replaces the variant list in one atomic step: updates kept ids, creates new ones, deletes the rest.
  saveVariants(product_id: string, variants: VariantInput[]): Promise<AdminVariant[]>; // not_found, sku_taken, invalid_input
  addProductImage(product_id: string, file: File): Promise<AdminProductImage[]>; // not_found, too_many_images
  removeProductImage(product_id: string, image: string): Promise<AdminProductImage[]>; // not_found
  // Same images, new order only.
  reorderProductImages(product_id: string, images: string[]): Promise<AdminProductImage[]>; // not_found, invalid_input
  setImageColor(product_id: string, image: string, color: string): Promise<AdminProductImage[]>; // not_found
  // Drag-and-drop tree: new parent and position for each category, applied together.
  moveCategories(moves: { id: string; parent_id: string; sort_order: number }[]): Promise<void>; // not_found

  // CSV import
  categoryIdsBySlug(): Promise<Map<string, string>>;
  // Upserts a product by handle and its variants by SKU (variants not in the file are kept).
  // `loadImages` is only called for products that have no images yet.
  importProduct(
    item: ImportProduct,
    category_id: string,
    options: { update_existing: boolean; loadImages: (() => Promise<File[]>) | null },
  ): Promise<ImportItemResult>;
  importCategory(
    category: ImportCategory,
    parent_id: string,
    update_existing: boolean,
  ): Promise<ImportItemResult & { id?: string }>;
};

// ---------- Checkout ----------

// A sellable variant with what pricing needs (public visibility rules apply).
export type PricingVariant = {
  variant_id: string;
  product_id: string;
  slug: string;
  title: LocalizedText;
  size: string;
  color: string;
  sku: string;
  // Thumbnail URL of the product's main image.
  image: string;
  price_override: number;
  product_price: number;
  compare_at_price: number;
  stock: number;
};

export type DiscountCode = {
  id: string;
  code: string;
  type: PricingDiscount["type"];
  value: number;
  min_subtotal: number;
  starts_at: string;
  ends_at: string;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  title: string;
  applies_to: DiscountAppliesTo;
  once_per_customer: boolean;
};

export type CheckoutTotalsFields = Omit<OrderTotals, "currency">;

export type CheckoutSession = CheckoutTotalsFields & {
  id: string;
  user: string;
  email: string;
  locale: string;
  line_items: PricedLine[];
  currency: string;
  shipping_method: string;
  payment_method: PaymentMethod | "";
  // Discount code id ("" = none).
  discount_code: string;
  status: "open" | "completed" | "expired" | "failed";
  expires_at: string;
  shipping_address: AddressFields | null;
  billing_address: AddressFields | null;
  // Saved before a card payment, so the order placed by the Stripe webhook keeps it.
  customer_note: string;
  // Where the visitor came from (the "utm" cookie) and, with marketing consent, what the server
  // Purchase event needs (consent_marketing = "1", client_ip, user_agent, fbp, fbc).
  attribution: Attribution | null;
  // A gift card applied at checkout and the part of the total it pays (0 = none).
  gift_card_id: string;
  gift_card_amount: number;
};

export type CheckoutSessionPatch = Partial<Omit<CheckoutSession, "id" | "expires_at">>;

export type NewOrder = CheckoutTotalsFields & {
  user: string;
  email: string;
  phone: string;
  locale: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  currency: string;
  discount_code: string;
  shipping_address: AddressFields;
  billing_address: AddressFields | null;
  // Human label of the shipping method, as shown at checkout.
  shipping_method: string;
  customer_note: string;
  checkout_session: string;
  // The order's payment row. Default: a pending payment (cash on delivery, manual methods).
  // Card orders arrive paid: the Stripe webhook passes the payment intent and "succeeded".
  payment?: { provider_ref: string; status: "pending" | "succeeded" };
  // UTM and click ids only (no IP or browser data).
  attribution?: Attribution | null;
  // Paid with a gift card (the rest with payment_method).
  gift_card_total?: number;
};

export type OrderConfirmationRecord = OrderTotals & {
  order_number: number;
  // Paid with a gift card; the rest (total - gift_card_total) with payment_method.
  gift_card_total: number;
  email: string;
  status: OrderStatus;
  payment_method: PaymentMethod | "";
  shipping_address: AddressFields | null;
  shipping_method: string;
  user: string;
};

export type CheckoutBackend = {
  pricingVariants(variant_ids: string[]): Promise<PricingVariant[]>;
  // The active code with this (upper-cased) code, whatever its dates and usage; null if none.
  findDiscount(code: string): Promise<DiscountCode | null>;
  getDiscountCode(id: string): Promise<string | null>;
  createSession(
    session: Omit<
      CheckoutSession,
      | "id"
      | "shipping_address"
      | "billing_address"
      | "customer_note"
      | "attribution"
      | "gift_card_id"
      | "gift_card_amount"
    > & {
      attribution?: Attribution | null;
    },
  ): Promise<{ id: string }>;
  getSession(id: string): Promise<CheckoutSession | null>;
  updateSession(id: string, patch: CheckoutSessionPatch): Promise<void>;
  recordFailedPayment(payment: {
    session_id: string;
    amount: number;
    currency: string;
    error_code: string;
  }): Promise<void>;
  // All or nothing: the order, its items, the stock decrement, the "created" event, a pending
  // payment, the discount usage and the session marked completed with `session_patch`.
  placeOrder(
    order: NewOrder,
    lines: PricedLine[],
    session_patch: CheckoutSessionPatch,
  ): Promise<{ order_number: number }>; // out_of_stock
  orderForSession(session_id: string): Promise<OrderConfirmationRecord | null>;
};

// ---------- Orders: shapes shared by the customer account and the admin ----------

export type OrderItem = {
  id: string;
  product: string;
  variant: string;
  title: string;
  variant_label: string;
  sku: string;
  image: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type OrderEvent = {
  id: string;
  type: OrderEventType;
  from_status: string;
  to_status: string;
  message: string;
  is_customer_visible: boolean;
  actor: string;
  created_at: string;
};

export type OrderTotals = {
  currency: string;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  discount_total: number;
  cod_fee: number;
  total: number;
};

// ---------- Orders admin ----------

export type AdminOrderRow = {
  id: string;
  order_number: number;
  created_at: string;
  customer_name: string;
  email: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  total: number;
  currency: string;
  item_count: number;
};

export type AdminOrderEvent = Omit<OrderEvent, "actor"> & { actor_name: string };

export type AdminPayment = {
  id: string;
  provider: string;
  // The provider's id for the payment (Stripe payment intent), for refunds.
  provider_ref: string;
  status: PaymentRecordStatus;
  amount: number;
  error_code: string;
  created_at: string;
};

export type AdminOrderDetail = OrderTotals & {
  id: string;
  order_number: number;
  created_at: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | "";
  email: string;
  phone: string;
  locale: string;
  shipping_address: AddressFields | null;
  billing_address: AddressFields | null;
  shipping_method: string;
  customer_note: string;
  internal_note: string;
  // Where the customer came from (UTM and click ids), null when unknown.
  attribution: Attribution | null;
  refunded_total: number;
  refunds: OrderRefund[];
  gift_card_total: number;
  // The checkout session the order came from ("" for orders placed another way). It holds the
  // gift card that paid part of it, so refunds can put that part back on the card.
  checkout_session_id: string;
  tracking_number: string;
  carrier: string;
  tracking_url: string;
  paid_at: string;
  shipped_at: string;
  delivered_at: string;
  cancelled_at: string;
  items: OrderItem[];
  events: AdminOrderEvent[];
  payments: AdminPayment[];
  customer: { user_id: string; name: string; order_count: number } | null;
  discount_code: string;
};

// What the lifecycle rules need to decide whether a change is allowed.
export type OrderState = {
  id: string;
  order_number: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | "";
  total: number;
  currency: string;
  refunded_total: number;
};

export type OrderRefund = {
  id: string;
  created_at: string;
  amount: number;
  reason: string;
  lines: { item_id: string; quantity: number }[];
  restocked: boolean;
  actor_name: string;
};

export type NewRefund = {
  amount: number;
  lines: { item_id: string; quantity: number }[];
  reason: string;
  restock: boolean;
  provider_ref: string;
  actor: string;
};

export type OrdersBackend = {
  list(filters: OrderListFilters, page_size: number): Promise<Page<AdminOrderRow>>;
  get(id: string): Promise<AdminOrderDetail>; // not_found (also for soft-deleted)
  getIdByNumber(order_number: number): Promise<string | null>;
  getState(id: string): Promise<OrderState | null>;
  // Each change below is atomic and writes its own timeline event (actor = staff user id).
  changeStatus(
    order: OrderState,
    to: OrderStatus,
    options: {
      actor: string;
      timestamp_field: "shipped_at" | "delivered_at" | "cancelled_at" | null;
      restock: boolean;
    },
  ): Promise<void>;
  // Settles the pending payment (or records one) and sets payment_status = paid.
  markPaid(order: OrderState, actor: string): Promise<void>;
  // Records a refund in one step: the refund row, refunded_total, the payment status
  // (partially_refunded, or refunded with status refunded once everything is back), restock of
  // the chosen lines, and a "refund" event.
  refund(order: OrderState, refund: NewRefund): Promise<{ refunded_total: number; is_full: boolean }>;
  // `ship` = also move the order to shipped (customer-visible event); otherwise an internal note.
  updateTracking(
    order: OrderState,
    tracking: { carrier: string; tracking_number: string; tracking_url: string },
    options: { actor: string; ship: boolean },
  ): Promise<void>;
  addNote(order_id: string, note: { message: string; is_customer_visible: boolean; actor: string }): Promise<void>;
  setInternalNote(order_id: string, internal_note: string): Promise<void>;
};

// ---------- Reports (admin home) ----------

export type ReportOrder = { created_at: string; status: OrderStatus; total: number };
export type SoldItem = { product: string; title: string; quantity: number; line_total: number };
export type LowStockVariant = {
  variant_id: string;
  product_id: string;
  product_title: LocalizedText;
  sku: string;
  color: string;
  size: string;
  stock: number;
};

export type ReportsBackend = {
  // Orders created at or after `from` (ISO), not deleted.
  ordersSince(from: string): Promise<ReportOrder[]>;
  countOrdersWithStatus(statuses: readonly OrderStatus[]): Promise<number>;
  // Unpaid cash-on-delivery orders that are still going ahead.
  codToCollect(): Promise<number>;
  recentOrders(limit: number): Promise<AdminOrderRow[]>;
  // Items of orders since `from` that weren't cancelled or refunded.
  soldItemsSince(from: string): Promise<SoldItem[]>;
  // Active variants of live products with stock at or below `threshold`, lowest first.
  lowStock(threshold: number, limit: number): Promise<LowStockVariant[]>;

  // Analytics: [from, to) in ISO times. Orders that aren't deleted (any status).
  analyticsOrders(from: string, to: string): Promise<AnalyticsOrder[]>;
  // Items of orders in the range that weren't cancelled or refunded, with the product's category.
  analyticsItems(from: string, to: string): Promise<AnalyticsItem[]>;
  // Which of these emails (lower case) ordered before `before`.
  emailsWithOrdersBefore(before: string, emails: string[]): Promise<string[]>;
  // Checkouts started in the range, and how many ended in an order.
  checkoutsBetween(from: string, to: string): Promise<{ started: number; completed: number }>;
};

export type AnalyticsOrder = {
  created_at: string;
  status: OrderStatus;
  total: number;
  // Partial refunds (full refunds have status refunded and aren't counted at all).
  refunded_total: number;
  discount_total: number;
  // Discount code id ("" = none).
  discount_code: string;
  email: string;
};

export type AnalyticsItem = {
  product: string;
  title: string;
  category_id: string;
  quantity: number;
  line_total: number;
};

// ---------- Customers admin ----------

export type CustomerUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  created_at: string;
  verified: boolean;
  accepts_marketing: boolean;
};
export type CustomerOrderRecord = {
  id: string;
  user: string;
  email: string;
  total: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  shipping_address: AddressFields | null;
};

export type CustomersBackend = {
  users(): Promise<CustomerUser[]>;
  // Every order that isn't deleted, oldest first.
  orderRecords(): Promise<CustomerOrderRecord[]>;
  // A registered customer's orders plus guest orders placed with their email; or a guest's orders.
  ordersOf(customer: { user_id: string | null; email: string }): Promise<AdminOrderRow[]>;
  savedAddresses(user_id: string): Promise<Address[]>;
  // Staff notes: customer_key = user id, or "email:<address>" for a guest.
  getNote(customer_key: string): Promise<string>;
  setNote(customer_key: string, note: string, actor: string): Promise<void>;
  setAcceptsMarketing(user_id: string, accepts_marketing: boolean): Promise<void>; // not_found
};

// ---------- Customer account (always the signed-in customer's own data) ----------

export type Address = AddressFields & { id: string; is_default: boolean };

export type CustomerOrderSummary = {
  id: string;
  order_number: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  currency: string;
  created_at: string;
};

export type CustomerOrderDetail = OrderTotals & {
  id: string;
  // Paid with a gift card; the rest (total - gift_card_total) with payment_method.
  gift_card_total: number;
  order_number: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | "";
  shipping_address: AddressFields | null;
  billing_address: AddressFields | null;
  shipping_method: string;
  customer_note: string;
  tracking_number: string;
  carrier: string;
  tracking_url: string;
  email: string;
  created_at: string;
  items: Pick<
    OrderItem,
    "id" | "title" | "variant_label" | "sku" | "image" | "unit_price" | "quantity" | "line_total"
  >[];
  events: Pick<OrderEvent, "id" | "type" | "to_status" | "message" | "created_at">[];
};

export type AccountBackend = {
  updateProfile(user_id: string, profile: { name: string; phone: string }): Promise<void>;
  // Keeps this browser signed in afterwards (passwords changes revoke sessions in some backends).
  changePassword(user: SessionUser, old_password: string, password: string): Promise<void>; // wrong_password
  listAddresses(user_id: string): Promise<Address[]>;
  // The first address is always the default; only one default per customer.
  createAddress(user_id: string, address: AddressFields & { is_default: boolean }): Promise<Address>;
  updateAddress(user_id: string, id: string, address: AddressFields & { is_default: boolean }): Promise<Address>; // not_found
  setDefaultAddress(user_id: string, id: string): Promise<void>; // not_found
  deleteAddress(user_id: string, id: string): Promise<void>; // not_found
  listOrders(user_id: string, limit: number): Promise<CustomerOrderSummary[]>;
  // Events: only the ones the customer may see, newest first.
  getOrder(user_id: string, id: string): Promise<CustomerOrderDetail>; // not_found
};

// ---------- The whole backend ----------

export type Backend = {
  name: "pocketbase" | "supabase" | "sqlite";
  auth: AuthBackend;
  staff: StaffBackend;
  saved_views: SavedViewsBackend;
  domains: DomainsBackend;
  themes: ThemesBackend;
  pages: PagesBackend;
  media: MediaBackend;
  email_log: EmailLogBackend;
  inventory: InventoryBackend;
  draft_orders: DraftOrdersBackend;
  discounts: DiscountsBackend;
  abandoned_checkouts: AbandonedCheckoutsBackend;
  collections: CollectionsBackend;
  gift_cards: GiftCardsBackend;
  reviews: ReviewsBackend;
  wishlist: WishlistBackend;
  api_keys: ApiKeysBackend;
  activity: ActivityBackend;
  settings: SettingsBackend;
  messages: MessagesBackend;
  account: AccountBackend;
  storefront: StorefrontBackend;
  catalog: CatalogBackend;
  checkout: CheckoutBackend;
  orders: OrdersBackend;
  reports: ReportsBackend;
  customers: CustomersBackend;
};
