"use client";

import {
  ChartColumnIcon,
  FilePenLineIcon,
  FileTextIcon,
  FolderTreeIcon,
  GiftIcon,
  MessageSquareQuoteIcon,
  HomeIcon,
  InboxIcon,
  LayersIcon,
  PackageIcon,
  PaletteIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TicketPercentIcon,
  UploadIcon,
  UsersIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type { AdminNavChildKey, AdminNavKey } from "@/app/(admin)/nav";
import { SETTINGS_RETURN_KEY } from "@/components/shell/settings-return";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@repo/ui/components/ui/sidebar";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { formatPlural } from "@repo/core/lib/utils/format";

// Icons are components, so they can't come from the server: they're mapped here by key.
const NAV_ICONS: Record<AdminNavKey | AdminNavChildKey, LucideIcon> = {
  home: HomeIcon,
  orders: ReceiptIcon,
  drafts: FilePenLineIcon,
  abandoned: ShoppingCartIcon,
  products: PackageIcon,
  inventory: WarehouseIcon,
  collections: LayersIcon,
  categories: FolderTreeIcon,
  gift_cards: GiftIcon,
  reviews: MessageSquareQuoteIcon,
  import: UploadIcon,
  customers: UsersIcon,
  analytics: ChartColumnIcon,
  discounts: TicketPercentIcon,
  messages: InboxIcon,
  themes: PaletteIcon,
  pages: FileTextIcon,
  settings: SettingsIcon,
};

export type SidebarNavItem = {
  key: AdminNavKey;
  href: string;
  // Unread count shown next to the entry (0 hides it).
  badge: number;
  children: { key: AdminNavChildKey; href: string }[];
};

type AdminSidebarProps = {
  lang: string;
  site_name: string;
  nav_items: SidebarNavItem[];
  settings_item: SidebarNavItem | null;
  dictionary: AdminDictionary["dashboard"]["nav"];
};

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ lang, site_name, nav_items, settings_item, dictionary }: AdminSidebarProps) {
  const pathname = usePathname();

  // The settings panel's ✕ returns here.
  useEffect(() => {
    try {
      sessionStorage.setItem(SETTINGS_RETURN_KEY, pathname);
    } catch {
      // Storage blocked (private mode): ✕ falls back to the dashboard.
    }
  }, [pathname]);
  const { setOpenMobile } = useSidebar();
  // On phones the sidebar is a sheet: close it once a link is followed.
  const closeOnPhone = () => setOpenMobile(false);

  function renderItem(item: SidebarNavItem) {
    const Icon = NAV_ICONS[item.key];
    const active_child = item.children.find((child) => isActive(pathname, child.href));
    const is_section_open = isActive(pathname, item.href) || Boolean(active_child);
    // The parent is "the current page" only when no sub-entry is.
    const is_current = is_section_open && !active_child;

    return (
      <SidebarMenuItem key={item.key}>
        <SidebarMenuButton asChild isActive={is_current}>
          <Link href={item.href} aria-current={is_current ? "page" : undefined} onClick={closeOnPhone}>
            <Icon />
            <span>{dictionary[item.key]}</span>
            {item.badge > 0 && <span className="sr-only">({formatPlural(item.badge, dictionary.unread, lang)})</span>}
          </Link>
        </SidebarMenuButton>
        {item.badge > 0 && (
          <SidebarMenuBadge
            aria-hidden
            // The base badge recolors its text on hover/active; keep it readable on the primary fill.
            className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground rounded-full"
          >
            {item.badge > 99 ? "99+" : item.badge}
          </SidebarMenuBadge>
        )}
        {is_section_open && item.children.length > 0 && (
          <SidebarMenuSub>
            {item.children.map((child) => {
              const is_child_current = child === active_child;
              return (
                <SidebarMenuSubItem key={child.key}>
                  <SidebarMenuSubButton asChild isActive={is_child_current}>
                    <Link href={child.href} aria-current={is_child_current ? "page" : undefined} onClick={closeOnPhone}>
                      <span>{dictionary[child.key]}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar mobileTitle={dictionary.label}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={closeOnPhone}>
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
                  {site_name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate font-semibold">{site_name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label={dictionary.label}>
              <SidebarMenu>{nav_items.map(renderItem)}</SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {settings_item && (
        <SidebarFooter>
          <SidebarMenu>{renderItem(settings_item)}</SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
