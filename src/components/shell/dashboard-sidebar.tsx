"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarThemePicker } from "@/components/shell/sidebar-theme-picker";
import { useSidebarTheme } from "@/hooks/use-sidebar-theme";
import { themeStyleVars } from "@/lib/theme/sidebar-themes";
import type { NavGroup } from "@/components/shell/dashboard-nav";
import type { UserRole } from "@/types/domain";

function NavLink({
  href,
  active,
  label,
  icon: Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: NavGroup["items"][number]["icon"];
}) {
  const { setOpenMobile, isMobile } = useSidebar();

  return (
    <SidebarMenuButton asChild isActive={active} tooltip={label} className="min-h-11 md:min-h-9">
      <Link
        href={href}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    </SidebarMenuButton>
  );
}

export function DashboardSidebar({
  groups,
  role,
}: {
  groups: NavGroup[];
  role: UserRole;
}) {
  const pathname = usePathname();
  const { themeId, setThemeId, ready } = useSidebarTheme();

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-sidebar-border"
      style={ready ? themeStyleVars(themeId) : undefined}
    >
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            RS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">RealSite</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{role.replace(/_/g, " ")}</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                return (
                  <SidebarMenuItem key={item.href}>
                    <NavLink href={item.href} active={active} label={item.label} icon={Icon} />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarThemePicker value={themeId} onChange={setThemeId} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
