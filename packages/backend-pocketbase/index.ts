import "server-only";

import type { Backend } from "@repo/core/backend/types";
import { account } from "@repo/backend-pocketbase/account";
import { activity } from "@repo/backend-pocketbase/activity";
import { auth } from "@repo/backend-pocketbase/auth";
import { catalog } from "@repo/backend-pocketbase/catalog";
import { checkout } from "@repo/backend-pocketbase/checkout";
import { customers } from "@repo/backend-pocketbase/customers";
import { domains } from "@repo/backend-pocketbase/domains";
import { messages } from "@repo/backend-pocketbase/messages";
import { orders } from "@repo/backend-pocketbase/orders";
import { reports } from "@repo/backend-pocketbase/reports";
import { settings } from "@repo/backend-pocketbase/settings";
import { saved_views, staff } from "@repo/backend-pocketbase/staff";
import { storefront } from "@repo/backend-pocketbase/storefront";
import { themes } from "@repo/backend-pocketbase/themes";
import { media, pages } from "@repo/backend-pocketbase/pages";
import { email_log } from "@repo/backend-pocketbase/email-log";
import { inventory } from "@repo/backend-pocketbase/inventory";
import { draft_orders } from "@repo/backend-pocketbase/draft-orders";
import { discounts } from "@repo/backend-pocketbase/discounts";
import { abandoned_checkouts } from "@repo/backend-pocketbase/abandoned-checkouts";
import { collections } from "@repo/backend-pocketbase/collections";
import { gift_cards } from "@repo/backend-pocketbase/gift-cards";
import { reviews } from "@repo/backend-pocketbase/reviews";
import { wishlist } from "@repo/backend-pocketbase/wishlist";
import { api_keys } from "@repo/backend-pocketbase/api-keys";

// PocketBase: data, auth and files in one binary (BACKEND=pocketbase).
export const pocketbase_backend: Backend = {
  name: "pocketbase",
  auth,
  staff,
  saved_views,
  domains,
  themes,
  pages,
  media,
  email_log,
  inventory,
  draft_orders,
  discounts,
  abandoned_checkouts,
  collections,
  gift_cards,
  reviews,
  wishlist,
  api_keys,
  activity,
  settings,
  messages,
  account,
  storefront,
  catalog,
  checkout,
  orders,
  reports,
  customers,
};
