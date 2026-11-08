import type { ProductListFilters } from "@repo/core/lib/schemas/catalog";
import type { MessageFilters } from "@repo/core/lib/schemas/contact";
import type { ActivityFilters, SavedViewResource } from "@repo/core/lib/schemas/admin";
import type { CustomerListFilters } from "@repo/core/lib/schemas/customers";
import type { OrderListFilters } from "@repo/core/lib/schemas/orders";
import type { AnalyticsFilters } from "@repo/core/lib/analytics";
import type { AbandonedCheckoutFilters } from "@repo/core/lib/schemas/abandoned-checkouts";
import type { GiftCardFilters } from "@repo/core/lib/schemas/gift-cards";
import type { DiscountListFilters } from "@repo/core/lib/schemas/discounts";
import type { DraftListFilters } from "@repo/core/lib/schemas/draft-orders";
import type { InventoryFilters } from "@repo/core/lib/schemas/inventory";
import type { ReviewFilters } from "@repo/core/lib/schemas/reviews";

// Every TanStack Query key comes from here, so invalidation can't miss a typo.
export const query_keys = {
  site_settings: ["site_settings"] as const,
  all_settings: ["all_settings"] as const,
  my_access: ["my_access"] as const,
  my_addresses: ["my_addresses"] as const,
  my_profile: ["my_profile"] as const,
  admin_categories: ["admin_categories"] as const,
  // Prefix for invalidating every product list page and filter.
  admin_products_all: ["admin_products"] as const,
  admin_products: (filters: ProductListFilters) => ["admin_products", filters] as const,
  admin_product: (id: string) => ["admin_product", id] as const,
  admin_orders_all: ["admin_orders"] as const,
  admin_orders: (filters: OrderListFilters) => ["admin_orders", filters] as const,
  admin_order: (id: string) => ["admin_order", id] as const,
  admin_search: (query: string) => ["admin_search", query] as const,
  domains: ["domains"] as const,
  themes: ["themes"] as const,
  navigation: ["navigation"] as const,
  pages: ["pages"] as const,
  media: ["media"] as const,
  payments: ["payments"] as const,
  tracking: ["tracking"] as const,
  collections: ["collections"] as const,
  wishlist: ["wishlist"] as const,
  api_keys: ["api_keys"] as const,
  wishlist_products: (ids: string[]) => ["wishlist_products", ids] as const,
  product_reviews: (product_id: string) => ["product_reviews", product_id] as const,
  my_review: (product_id: string) => ["my_review", product_id] as const,
  reviews_all: ["reviews"] as const,
  reviews: (filters: ReviewFilters) => ["reviews", filters] as const,
  gift_cards_all: ["gift_cards"] as const,
  gift_cards: (filters: GiftCardFilters) => ["gift_cards", filters] as const,
  gift_card: (id: string) => ["gift_cards", "one", id] as const,
  collection: (id: string) => ["collections", id] as const,
  analytics: (filters: AnalyticsFilters) => ["analytics", filters] as const,
  notifications: ["notifications"] as const,
  email_log: (page: number) => ["email_log", page] as const,
  inventory_all: ["inventory"] as const,
  inventory: (filters: InventoryFilters) => ["inventory", filters] as const,
  stock_history: (variant_id: string) => ["stock_history", variant_id] as const,
  abandoned_checkouts_all: ["abandoned_checkouts"] as const,
  abandoned_checkouts: (filters: AbandonedCheckoutFilters) => ["abandoned_checkouts", filters] as const,
  discounts_all: ["discounts"] as const,
  discounts: (filters: DiscountListFilters) => ["discounts", filters] as const,
  discount: (id: string) => ["discounts", "one", id] as const,
  draft_orders_all: ["draft_orders"] as const,
  draft_orders: (filters: DraftListFilters) => ["draft_orders", filters] as const,
  draft_variant_search: (search: string) => ["draft_variant_search", search] as const,
  draft_customer_search: (search: string) => ["draft_customer_search", search] as const,
  draft_order: (id: string) => ["draft_orders", id] as const,
  theme: (id: string) => ["themes", id] as const,
  team_members: ["team_members"] as const,
  roles: ["roles"] as const,
  activity: (filters: ActivityFilters) => ["activity", filters] as const,
  saved_views: (resource: SavedViewResource) => ["saved_views", resource] as const,
  admin_customers: (filters: CustomerListFilters) => ["admin_customers", filters] as const,
  customer_note: (key: string) => ["customer_note", key] as const,
  messages_all: ["messages"] as const,
  messages: (filters: MessageFilters) => ["messages", filters] as const,
  cart_lines: (lines: { variant_id: string; quantity: number }[], locale: string) =>
    ["cart_lines", locale, lines] as const,
};
