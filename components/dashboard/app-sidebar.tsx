"use client";

import {
  ChevronsUpDownIcon,
  FolderTreeIcon,
  PackageIcon,
  ReceiptIcon,
  ExternalLinkIcon,
  HomeIcon,
  InboxIcon,
  LogOutIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import type { DashboardNavKey } from "@/app/[lang]/dashboard/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/sidebar";
import { useSignOut } from "@/hooks/use-auth";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";

// Icons are components, so they can't come from the server: they're mapped here by key.
const NAV_ICONS: Record<DashboardNavKey, LucideIcon> = {
  home: HomeIcon,
  orders: ReceiptIcon,
  products: PackageIcon,
  categories: FolderTreeIcon,
  messages: InboxIcon,
  settings: SettingsIcon,
};

type AppSidebarProps = {
  lang: string;
  site_name: string;
  // badge: unread count shown next to the entry (0 hides it).
  nav_items: { key: DashboardNavKey; href: string; badge: number }[];
  user: { name: string; email: string };
  dictionary: Dictionary["dashboard"]["nav"];
  errors: Dictionary["errors"];
};

export function AppSidebar({ lang, site_name, nav_items, user, dictionary, errors }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sign_out = useSignOut();
  const home_href = `/${lang}/dashboard`;

  function onSignOut() {
    sign_out.mutate(undefined, {
      onSuccess: () => {
        router.replace(`/${lang}/auth/login`);
        router.refresh();
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <Sidebar mobileTitle={dictionary.label}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={home_href}>
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
              <SidebarMenu>
                {nav_items.map((item) => {
                  const Icon = NAV_ICONS[item.key];
                  const is_active = item.href === home_href ? pathname === home_href : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={is_active}>
                        <Link href={item.href} aria-current={is_active ? "page" : undefined}>
                          <Icon />
                          <span>{dictionary[item.key]}</span>
                          {item.badge > 0 && (
                            <span className="sr-only">
                              ({dictionary.unread.replace("{count}", String(item.badge))})
                            </span>
                          )}
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
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={`/${lang}`} target="_blank" rel="noopener">
                <ExternalLinkIcon />
                <span>{dictionary.view_store}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" aria-label={dictionary.account_menu}>
                  <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name || user.email}</span>
                    <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                  </span>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onSignOut} disabled={sign_out.isPending}>
                  <LogOutIcon />
                  {dictionary.sign_out}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
