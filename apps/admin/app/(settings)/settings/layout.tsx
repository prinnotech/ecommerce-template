import { SETTINGS_NAV_GROUPS } from "./nav";
import { SettingsPanel } from "./components/settings-panel";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requireCaller } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// Settings open as their own full-screen panel (Shopify-style), outside the admin sidebar.
// Same guard as the admin: active staff only; each page checks its own permission too.
export default async function SettingsPanelLayout({ children }: LayoutProps<"/settings">) {
  const caller = await requireCaller();
  const lang = await getAdminLocale();
  const [dictionary, site_name] = await Promise.all([getAdminDictionary(lang), getSiteSetting("SITE_NAME")]);

  const groups = SETTINGS_NAV_GROUPS.map((group) => ({
    key: group.key,
    label: dictionary.settings.groups[group.key],
    items: group.items
      .filter((item) => item.permission === null || callerShows(caller, item.permission))
      .map((item) => ({ key: item.key, href: `/settings/${item.key}`, label: dictionary.settings.sections[item.key] })),
  })).filter((group) => group.items.length > 0);

  return (
    <TooltipProvider>
      <SettingsPanel
        title={dictionary.settings.title}
        site_name={site_name}
        close_label={dictionary.common.close}
        groups={groups}
      >
        {children}
      </SettingsPanel>
    </TooltipProvider>
  );
}
