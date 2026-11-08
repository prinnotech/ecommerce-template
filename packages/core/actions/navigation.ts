"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { navigation_schema, type Navigation } from "@repo/core/lib/schemas/navigation";
import { SITE_SETTINGS } from "@repo/core/lib/site-settings";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { revalidateStore } from "@repo/core/lib/store-revalidate";

// The header menu and footer (the NAVIGATION setting). Edited from the theme editor, so it uses
// the theme permissions; it isn't part of a theme, and a save is live at once (like Shopify menus).

export async function getNavigation(): Promise<ActionResult<Navigation>> {
  const auth = await authorize("themes.view", "view navigation");
  if (!auth.ok) return auth;
  return ok(await getSiteSetting("NAVIGATION"));
}

export async function saveNavigation(input: Navigation): Promise<ActionResult<{ is_store_refreshed: boolean }>> {
  const auth = await authorize("themes.edit", "edit the navigation");
  if (!auth.ok) return auth;
  const parsed = navigation_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const definition = SITE_SETTINGS.NAVIGATION;
    await getBackend().settings.save({
      key: "NAVIGATION",
      category: definition.category,
      value: parsed.data,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    await logActivity({ actor_id: auth.caller.user_id, action: "edit the navigation", target_type: "settings" });
    return ok({ is_store_refreshed: await revalidateStore() });
  } catch (error) {
    return failFrom(error, "navigation", "saveNavigation");
  }
}
