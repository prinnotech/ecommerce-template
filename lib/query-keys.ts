import type { ProductListFilters } from "@/lib/schemas/catalog";
import type { MessageFilters } from "@/lib/schemas/contact";
import type { OrderListFilters } from "@/lib/schemas/orders";

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
  messages_all: ["messages"] as const,
  messages: (filters: MessageFilters) => ["messages", filters] as const,
  cart_lines: (lines: { variant_id: string; quantity: number }[], locale: string) =>
    ["cart_lines", locale, lines] as const,
};
