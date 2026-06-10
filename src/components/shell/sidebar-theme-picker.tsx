"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SIDEBAR_THEMES, type SidebarMode, type SidebarThemeId } from "@/lib/theme/sidebar-themes";
import { cn } from "@/lib/utils";

export function SidebarThemePicker({
  value,
  mode,
  onChange,
  onModeChange,
}: {
  value: SidebarThemeId;
  mode: SidebarMode;
  onChange: (id: SidebarThemeId) => void;
  onModeChange: (mode: SidebarMode) => void;
}) {
  return (
    <div className="space-y-3 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sidebar</p>
        <div className="flex rounded-md border border-sidebar-border p-0.5">
          <Button
            type="button"
            size="icon"
            variant={mode === "light" ? "secondary" : "ghost"}
            className="h-7 w-7"
            onClick={() => onModeChange("light")}
            aria-label="Light sidebar"
          >
            <Sun className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={mode === "dark" ? "secondary" : "ghost"}
            className="h-7 w-7"
            onClick={() => onModeChange("dark")}
            aria-label="Dark sidebar"
          >
            <Moon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accent</p>
        <div className="flex flex-wrap gap-2">
          {SIDEBAR_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={`${t.label} accent`}
              onClick={() => onChange(t.id)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                value === t.id ? "border-foreground ring-2 ring-offset-1 ring-offset-sidebar" : "border-transparent",
              )}
              style={{ backgroundColor: t.swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
