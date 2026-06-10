"use client";

import { SIDEBAR_THEMES, type SidebarThemeId } from "@/lib/theme/sidebar-themes";
import { cn } from "@/lib/utils";

export function SidebarThemePicker({
  value,
  onChange,
  compact,
}: {
  value: SidebarThemeId;
  onChange: (id: SidebarThemeId) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", compact ? "px-2 py-2" : "px-3 py-3")}>
      {!compact && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accent</p>}
      <div className="flex flex-wrap gap-2">
        {SIDEBAR_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={`${t.label} theme`}
            onClick={() => onChange(t.id)}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              value === t.id ? "border-foreground ring-2 ring-offset-2 ring-offset-background" : "border-transparent",
            )}
            style={{ backgroundColor: t.swatch }}
          />
        ))}
      </div>
    </div>
  );
}
