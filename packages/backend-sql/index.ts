import "server-only";

import type { AuthBackend, Backend } from "@repo/core/backend/types";
import { createAccount, type AccountAuth } from "@repo/backend-sql/account";
import { createCatalog } from "@repo/backend-sql/catalog";
import { createCheckout } from "@repo/backend-sql/checkout";
import { createActivity, createMessages, createSettings } from "@repo/backend-sql/content";
import type { SqlContext } from "@repo/backend-sql/context";
import { createCustomers } from "@repo/backend-sql/customers";
import { createOrders } from "@repo/backend-sql/orders";
import { createReports } from "@repo/backend-sql/reports";
import { createStorefront } from "@repo/backend-sql/storefront";
import { createDomains } from "@repo/backend-sql/domains";
import { createThemes } from "@repo/backend-sql/themes";
import { createMedia, createPages } from "@repo/backend-sql/pages";
import { createEmailLog } from "@repo/backend-sql/email-log";
import { createInventory } from "@repo/backend-sql/inventory";
import { createDraftOrders } from "@repo/backend-sql/draft-orders";
import { createDiscounts } from "@repo/backend-sql/discounts";
import { createAbandonedCheckouts } from "@repo/backend-sql/abandoned-checkouts";
import { createCollections } from "@repo/backend-sql/collections";
import { createGiftCards } from "@repo/backend-sql/gift-cards";
import { createReviews } from "@repo/backend-sql/reviews";
import { createWishlist } from "@repo/backend-sql/wishlist";
import { createApiKeys } from "@repo/backend-sql/api-keys";
import { createSavedViews, createStaff } from "@repo/backend-sql/team";

// A complete backend from a SQL database (Kysely), a file storage and an auth provider.
// Supabase and SQLite only differ in those three pieces.
export function createSqlBackend(options: {
  name: "supabase" | "sqlite";
  context: SqlContext;
  auth: AuthBackend & AccountAuth;
}): Backend {
  const { context, auth } = options;
  return {
    name: options.name,
    auth,
    staff: createStaff(context),
    saved_views: createSavedViews(context),
    domains: createDomains(context),
    themes: createThemes(context),
    pages: createPages(context),
    media: createMedia(context),
    email_log: createEmailLog(context),
    inventory: createInventory(context),
    draft_orders: createDraftOrders(context),
    discounts: createDiscounts(context),
    abandoned_checkouts: createAbandonedCheckouts(context),
    collections: createCollections(context),
    gift_cards: createGiftCards(context),
    reviews: createReviews(context),
    wishlist: createWishlist(context),
    api_keys: createApiKeys(context),
    activity: createActivity(context),
    settings: createSettings(context),
    messages: createMessages(context),
    account: createAccount(context, auth),
    storefront: createStorefront(context),
    catalog: createCatalog(context),
    checkout: createCheckout(context),
    orders: createOrders(context),
    reports: createReports(context),
    customers: createCustomers(context),
  };
}
