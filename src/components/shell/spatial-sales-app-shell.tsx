"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useUserRole, canAccessRoute } from "@/components/auth/role-guard";
import { DashboardSidebar } from "@/components/shell/dashboard-sidebar";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { getVisibleNavGroups } from "@/components/shell/dashboard-nav";
import { useSidebarTheme } from "@/hooks/use-sidebar-theme";
import { themeStyleVars } from "@/lib/theme/sidebar-themes";

export function SpatialSalesAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useUserRole();
  const visibleGroups = getVisibleNavGroups(role);
  const { themeId, mode, ready } = useSidebarTheme();

  const isFullscreenRoute =
    pathname.includes("/dashboard/capture/") ||
    pathname.includes("/dashboard/experiences/builder");

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-svh w-full" style={ready ? themeStyleVars(themeId, mode) : undefined}>
        <DashboardSidebar groups={visibleGroups} role={role} />
        <SidebarInset className="flex min-h-svh flex-col overflow-x-hidden bg-muted/30">
        {!isFullscreenRoute && (
          <header
            className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4"
            style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
          >
            <SidebarTrigger className="size-10 shrink-0 md:size-7" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative hidden min-w-0 flex-1 sm:block md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search developments, listings, leads…"
                  className="h-9 border-border/60 bg-background pl-9"
                />
              </div>
              <p className="truncate text-sm font-semibold sm:hidden">RealSite</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {canAccessRoute(role, "/dashboard/projects") && (
                <Button size="sm" className="hidden h-9 sm:inline-flex" asChild>
                  <Link href="/dashboard/projects/new">
                    <Plus className="mr-1 h-4 w-4" />
                    Development
                  </Link>
                </Button>
              )}
              <Button size="icon" variant="ghost" className="size-10 sm:hidden" asChild>
                <Link href="/dashboard/projects/new" aria-label="New development">
                  <Plus className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="icon" variant="ghost" className="size-9" asChild>
                <Link href="/dashboard/settings" aria-label="Workspace settings">
                  <Settings2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>
        )}

        <main
          className={
            isFullscreenRoute
              ? "flex flex-1 flex-col overflow-hidden"
              : "flex flex-1 flex-col overflow-x-hidden px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6"
          }
        >
          {children}
        </main>

        {!isFullscreenRoute && <MobileBottomNav role={role} />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
