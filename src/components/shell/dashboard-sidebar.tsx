"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
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
    <SidebarMenuButton asChild isActive={active} tooltip={label} className="min-h-11 md:min-h-8">
      <Link
        href={href}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Icon />
        <span>{label}</span>
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

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            SS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Spatial Sales</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{role.replace(/_/g, " ")}</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0 overflow-y-auto">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
      <SidebarRail />
    </Sidebar>
  );
}
