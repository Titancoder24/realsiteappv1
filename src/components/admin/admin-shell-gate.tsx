"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

const NO_SHELL_PATHS = ["/admin/login", "/admin/setup"];

export function AdminShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_SHELL_PATHS.includes(pathname)) return <>{children}</>;
  return <AdminAppShell>{children}</AdminAppShell>;
}

function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [provider, setProvider] = useState<"openrouter" | "vertex" | undefined>();

  useEffect(() => {
    fetch("/api/admin/walkthrough-ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProvider(d.provider))
      .catch(() => {});
  }, [pathname]);

  const title =
    pathname === "/admin"
      ? "Platform Overview"
      : pathname.includes("walkthrough-ai")
        ? "Property Walkthrough AI"
        : pathname.includes("worldlabs")
          ? "World Labs"
          : pathname.includes("engines")
            ? "Engine Control"
            : pathname.includes("models")
              ? "Models & Voice"
              : pathname.includes("audit")
                ? "Audit Logs"
                : "Super Admin";

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full">
        <AdminSidebar activeProvider={provider} />
        <SidebarInset className="flex min-h-svh flex-col overflow-x-hidden bg-muted/20">
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-md">
            <SidebarTrigger className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-muted-foreground">Super Admin Panel</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" className="hidden sm:inline-flex" asChild>
                <Link href="/dashboard">
                  <LayoutGrid className="mr-1.5 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </header>
          <main className="flex flex-1 flex-col overflow-x-hidden px-4 py-5 md:px-6 md:py-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
