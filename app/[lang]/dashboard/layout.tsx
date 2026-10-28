import { cookies } from "next/headers";

import { DASHBOARD_NAV } from "./nav";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { callerCan, requireCaller } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { countUnreadMessages } from "@/lib/messages-server";
import { getSiteSetting } from "@/lib/site-settings-server";

// Server-side guard: team members with dashboard.view only. Customers are sent home.
export default async function DashboardLayout({ children, params }: LayoutProps<"/[lang]/dashboard">) {
  const { lang } = await params;
  const caller = await requireCaller(lang);
  const [dictionary, site_name, cookie_store] = await Promise.all([
    getDictionary(lang),
    getSiteSetting("SITE_NAME"),
    cookies(),
  ]);

  const unread_messages = callerCan(caller, "messages.view") ? await countUnreadMessages() : 0;
  const nav_items = DASHBOARD_NAV.filter((item) => callerCan(caller, item.permission)).map((item) => ({
    key: item.key,
    href: `/${lang}/dashboard${item.path}`,
    badge: item.key === "messages" ? unread_messages : 0,
  }));

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={cookie_store.get("sidebar_state")?.value !== "false"}>
        <AppSidebar
          lang={lang}
          site_name={site_name}
          nav_items={nav_items}
          user={{ name: caller.name, email: caller.email }}
          dictionary={dictionary.dashboard.nav}
          errors={dictionary.errors}
        />
        <SidebarInset>
          <header className="bg-background sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger label={dictionary.dashboard.nav.toggle_sidebar} className="-ml-1" />
          </header>
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
