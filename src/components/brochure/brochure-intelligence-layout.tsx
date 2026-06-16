"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/dashboard/brochure-intelligence/upload", label: "Upload & Links" },
  { href: "/dashboard/brochure-intelligence/overview", label: "Intelligence" },
  { href: "/dashboard/brochure-intelligence/viewers", label: "Identified Viewers" },
  { href: "/dashboard/brochure-intelligence/heatmaps", label: "Heatmaps" },
] as const;

export function BrochureIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Brochure Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Upload tracked brochures, identify every viewer, analyze engagement charts, and see picture-perfect click heatmaps.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === s.href || pathname.startsWith(`${s.href}/`)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
