export type SidebarThemeId = "indigo" | "emerald" | "rose" | "amber" | "slate";

export interface SidebarTheme {
  id: SidebarThemeId;
  label: string;
  swatch: string;
  vars: Record<string, string>;
}

/** Five accent palettes — applied to sidebar + primary actions. */
export const SIDEBAR_THEMES: SidebarTheme[] = [
  {
    id: "indigo",
    label: "Indigo",
    swatch: "#4f46e5",
    vars: {
      "--primary": "239 84% 67%",
      "--primary-foreground": "0 0% 100%",
      "--sidebar-primary": "239 84% 67%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "239 84% 96%",
      "--sidebar-accent-foreground": "239 84% 35%",
      "--ring": "239 84% 67%",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "#059669",
    vars: {
      "--primary": "160 84% 39%",
      "--primary-foreground": "0 0% 100%",
      "--sidebar-primary": "160 84% 39%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "160 60% 94%",
      "--sidebar-accent-foreground": "160 84% 25%",
      "--ring": "160 84% 39%",
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#e11d48",
    vars: {
      "--primary": "347 77% 50%",
      "--primary-foreground": "0 0% 100%",
      "--sidebar-primary": "347 77% 50%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "347 77% 96%",
      "--sidebar-accent-foreground": "347 77% 35%",
      "--ring": "347 77% 50%",
    },
  },
  {
    id: "amber",
    label: "Amber",
    swatch: "#d97706",
    vars: {
      "--primary": "32 95% 44%",
      "--primary-foreground": "0 0% 100%",
      "--sidebar-primary": "32 95% 44%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "32 95% 94%",
      "--sidebar-accent-foreground": "32 95% 30%",
      "--ring": "32 95% 44%",
    },
  },
  {
    id: "slate",
    label: "Slate",
    swatch: "#475569",
    vars: {
      "--primary": "215 16% 47%",
      "--primary-foreground": "0 0% 100%",
      "--sidebar-primary": "215 16% 47%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "215 16% 94%",
      "--sidebar-accent-foreground": "215 16% 30%",
      "--ring": "215 16% 47%",
    },
  },
];

export const DEFAULT_THEME_ID: SidebarThemeId = "indigo";

export function getSidebarTheme(id: SidebarThemeId) {
  return SIDEBAR_THEMES.find((t) => t.id === id) ?? SIDEBAR_THEMES[0];
}

export function themeStyleVars(id: SidebarThemeId): Record<string, string> {
  const theme = getSidebarTheme(id);
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.vars)) {
    style[k] = v.includes(" ") ? `hsl(${v})` : v;
  }
  return style;
}
