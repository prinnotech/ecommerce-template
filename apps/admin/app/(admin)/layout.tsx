import { cookies } from "next/headers";

import { ADMIN_NAV, SETTINGS_NAV } from "./nav";
import { AdminSidebar, type SidebarNavItem } from "@/components/shell/admin-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerCan, callerShows, requireCaller, type Caller } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { languageOptions } from "@repo/core/lib/locale/language-options";
import { countUnreadMessages } from "@repo/core/lib/messages-server";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

type NavSource = (typeof ADMIN_NAV)[number] | typeof SETTINGS_NAV;

function visibleChildren(entry: NavSource, caller: Caller) {
  return "children" in entry
    ? entry.children
        .filter((child) => callerShows(caller, child.permission))
        .map((child) => ({ key: child.key, href: child.path }))
    : [];
}

// An entry shows when the caller may open it, or one of its children (Drafts without Orders):
// then it links to that child instead.
function toNavItem(entry: NavSource, caller: Caller, unread_messages: number): SidebarNavItem | null {
  const children = visibleChildren(entry, caller);
  const can_open = callerCan(caller, entry.permission);
  if (!can_open && children.length === 0) return null;
  return {
    key: entry.key,
    href: can_open ? entry.path : (children[0]?.href ?? entry.path),
    badge: entry.key === "messages" ? unread_messages : 0,
    children,
  };
}

// Server-side guard: active team members with dashboard.view only. Customers go to the shop.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const caller = await requireCaller();
  const lang = await getAdminLocale();
  const [dictionary, site_name, cookie_store] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("SITE_NAME"),
    cookies(),
  ]);

  const unread_messages = callerCan(caller, "messages.view") ? await countUnreadMessages() : 0;
  const nav_items = ADMIN_NAV.map((entry) => toNavItem(entry, caller, unread_messages)).filter(
    (item): item is SidebarNavItem => item !== null,
  );
  const settings_item = callerCan(caller, SETTINGS_NAV.permission) ? toNavItem(SETTINGS_NAV, caller, 0) : null;

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={cookie_store.get("sidebar_state")?.value !== "false"}>
        <a
          href="#admin-main"
          className="bg-background sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {dictionary.common.skip_to_content}
        </a>
        <AdminSidebar
          lang={lang}
          site_name={site_name}
          nav_items={nav_items}
          settings_item={settings_item}
          dictionary={dictionary.dashboard.nav}
        />
        <SidebarInset>
          <TopBar
            lang={lang}
            site_name={site_name}
            user={{ name: caller.name, email: caller.email }}
            language_options={languageOptions()}
            dictionary={dictionary.admin_shell}
            toggle_sidebar_label={dictionary.dashboard.nav.toggle_sidebar}
            close_label={dictionary.common.close}
            errors={dictionary.errors}
          />
          <main id="admin-main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
