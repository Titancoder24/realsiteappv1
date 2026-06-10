import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Building2, Home, Layers, Map, Settings,
  Sparkles, Users, Box, Shield, FileText, Mic, CalendarDays, PackageCheck, Smartphone,
} from "lucide-react";
import type { UserRole } from "@/types/domain";
import { canAccessRoute } from "@/components/auth/role-guard";
import { canAccessAdmin } from "@/lib/auth/rbac";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: UserRole;
  adminOnly?: boolean;
  mobileTab?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const DASHBOARD_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: Home, mobileTab: true },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: Building2, minRole: "project_manager" },
      { href: "/dashboard/properties", label: "Properties", icon: Layers, minRole: "project_manager", mobileTab: true },
      { href: "/dashboard/experiences", label: "Experiences", icon: Box, minRole: "project_manager" },
      { href: "/dashboard/experiences/new", label: "Mobile Capture", icon: Smartphone, minRole: "project_manager", mobileTab: true },
      { href: "/dashboard/floor-maps", label: "Floor Maps", icon: Map, minRole: "project_manager" },
      { href: "/dashboard/inventory", label: "Inventory", icon: PackageCheck, minRole: "sales_agent" },
    ],
  },
  {
    label: "AI & Sales",
    items: [
      { href: "/dashboard/knowledge", label: "AI Knowledge", icon: FileText, minRole: "project_manager" },
      { href: "/dashboard/ai-agent", label: "AI Agent", icon: Mic, minRole: "project_manager" },
      { href: "/dashboard/leads", label: "Leads CRM", icon: Users, minRole: "sales_agent", mobileTab: true },
      { href: "/dashboard/site-visits", label: "Site Visits", icon: CalendarDays, minRole: "sales_agent" },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: Sparkles, minRole: "marketing_manager" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/team", label: "Team", icon: Users, minRole: "organization_admin" },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
    ],
  },
];

export function getVisibleNavGroups(role: UserRole) {
  return DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.adminOnly) return canAccessAdmin(role);
      return canAccessRoute(role, item.href);
    }),
  })).filter((g) => g.items.length > 0);
}

export function getMobileTabItems(role: UserRole) {
  const items: NavItem[] = [];
  for (const group of DASHBOARD_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.mobileTab && canAccessRoute(role, item.href) && !item.adminOnly) {
        items.push(item);
      }
    }
  }
  return items.slice(0, 4);
}
