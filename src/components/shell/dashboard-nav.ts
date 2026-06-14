import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building,
  Building2,
  Camera,
  Clapperboard,
  Compass,
  FileStack,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Mic2,
  Package,
  Settings2,
  ShieldCheck,
  UserRoundSearch,
  Users2,
  Video,
} from "lucide-react";
import type { UserRole } from "@/types/domain";
import { canAccessRoute } from "@/components/auth/role-guard";
import { canAccessAdmin } from "@/lib/auth/rbac";

export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
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
    label: "Command Center",
    items: [
      { href: "/dashboard", label: "Portfolio Pulse", shortLabel: "Pulse", icon: LayoutDashboard, mobileTab: true },
      { href: "/dashboard/analytics", label: "Buyer Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Property Portfolio",
    items: [
      { href: "/dashboard/projects", label: "Developments", icon: Building2, minRole: "project_manager" },
      { href: "/dashboard/properties", label: "Listings", shortLabel: "Listings", icon: Building, minRole: "project_manager", mobileTab: true },
      { href: "/dashboard/experiences", label: "Virtual Tours", icon: Compass, minRole: "project_manager" },
      { href: "/dashboard/experiences/new", label: "360° Capture", shortLabel: "Capture", icon: Camera, minRole: "project_manager", mobileTab: true },
      { href: "/dashboard/floor-maps", label: "Floor Plans", icon: MapPinned, minRole: "project_manager" },
      { href: "/dashboard/inventory", label: "Unit Inventory", icon: Package, minRole: "sales_agent" },
    ],
  },
  {
    label: "Sales & AI",
    items: [
      { href: "/dashboard/knowledge", label: "Property Intel", icon: FileStack, minRole: "project_manager" },
      { href: "/dashboard/ai-agent", label: "Voice Concierge", icon: Mic2, minRole: "project_manager" },
      { href: "/dashboard/leads", label: "Lead Pipeline", shortLabel: "Leads", icon: UserRoundSearch, minRole: "sales_agent", mobileTab: true },
      { href: "/dashboard/site-visits", label: "Site Visits", icon: Video, minRole: "sales_agent" },
      { href: "/dashboard/campaigns", label: "Campaign Hub", icon: Megaphone, minRole: "marketing_manager" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/team", label: "Team Access", icon: Users2, minRole: "organization_admin" },
      { href: "/dashboard/settings", label: "Workspace", icon: Settings2 },
      { href: "/admin", label: "Platform Admin", icon: ShieldCheck, adminOnly: true },
      { href: "/admin/walkthrough-ai", label: "Walkthrough AI", icon: Clapperboard, adminOnly: true },
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
