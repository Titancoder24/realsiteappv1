export type SidebarThemeId = "blue" | "emerald" | "rose" | "amber" | "violet";
export type SidebarMode = "light" | "dark";

export interface SidebarTheme {
  id: SidebarThemeId;
  label: string;
  swatch: string;
  /** Accent + chart palette — applied app-wide (buttons, charts, rings). */
  accent: {
    primary: string;
    primaryFg: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    ring: string;
  };
  /** Sidebar surface colors per mode. */
  surfaces: Record<SidebarMode, {
    sidebar: string;
    sidebarFg: string;
    sidebarBorder: string;
    sidebarAccent: string;
    sidebarAccentFg: string;
    sidebarPrimary: string;
    sidebarPrimaryFg: string;
  }>;
}

export const SIDEBAR_THEMES: SidebarTheme[] = [
  {
    id: "blue",
    label: "Blue",
    swatch: "#2563eb",
    accent: {
      primary: "#2563eb",
      primaryFg: "#ffffff",
      chart1: "#2563eb",
      chart2: "#3b82f6",
      chart3: "#60a5fa",
      chart4: "#1d4ed8",
      chart5: "#93c5fd",
      ring: "#2563eb",
    },
    surfaces: {
      light: {
        sidebar: "#ffffff",
        sidebarFg: "#1e293b",
        sidebarBorder: "#e2e8f0",
        sidebarAccent: "#eff6ff",
        sidebarAccentFg: "#1d4ed8",
        sidebarPrimary: "#2563eb",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#0f172a",
        sidebarFg: "#e2e8f0",
        sidebarBorder: "#1e293b",
        sidebarAccent: "#1e3a5f",
        sidebarAccentFg: "#93c5fd",
        sidebarPrimary: "#3b82f6",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "#059669",
    accent: {
      primary: "#059669",
      primaryFg: "#ffffff",
      chart1: "#059669",
      chart2: "#10b981",
      chart3: "#34d399",
      chart4: "#047857",
      chart5: "#6ee7b7",
      ring: "#059669",
    },
    surfaces: {
      light: {
        sidebar: "#ffffff",
        sidebarFg: "#1e293b",
        sidebarBorder: "#e2e8f0",
        sidebarAccent: "#ecfdf5",
        sidebarAccentFg: "#047857",
        sidebarPrimary: "#059669",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#0c1a14",
        sidebarFg: "#d1fae5",
        sidebarBorder: "#14532d",
        sidebarAccent: "#064e3b",
        sidebarAccentFg: "#6ee7b7",
        sidebarPrimary: "#10b981",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#e11d48",
    accent: {
      primary: "#e11d48",
      primaryFg: "#ffffff",
      chart1: "#e11d48",
      chart2: "#f43f5e",
      chart3: "#fb7185",
      chart4: "#be123c",
      chart5: "#fda4af",
      ring: "#e11d48",
    },
    surfaces: {
      light: {
        sidebar: "#ffffff",
        sidebarFg: "#1e293b",
        sidebarBorder: "#e2e8f0",
        sidebarAccent: "#fff1f2",
        sidebarAccentFg: "#be123c",
        sidebarPrimary: "#e11d48",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#1a0a0f",
        sidebarFg: "#fecdd3",
        sidebarBorder: "#4c0519",
        sidebarAccent: "#500724",
        sidebarAccentFg: "#fda4af",
        sidebarPrimary: "#f43f5e",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
  {
    id: "amber",
    label: "Amber",
    swatch: "#d97706",
    accent: {
      primary: "#d97706",
      primaryFg: "#ffffff",
      chart1: "#d97706",
      chart2: "#f59e0b",
      chart3: "#fbbf24",
      chart4: "#b45309",
      chart5: "#fcd34d",
      ring: "#d97706",
    },
    surfaces: {
      light: {
        sidebar: "#ffffff",
        sidebarFg: "#1e293b",
        sidebarBorder: "#e2e8f0",
        sidebarAccent: "#fffbeb",
        sidebarAccentFg: "#b45309",
        sidebarPrimary: "#d97706",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#1a1208",
        sidebarFg: "#fde68a",
        sidebarBorder: "#451a03",
        sidebarAccent: "#451a03",
        sidebarAccentFg: "#fcd34d",
        sidebarPrimary: "#f59e0b",
        sidebarPrimaryFg: "#1a1208",
      },
    },
  },
  {
    id: "violet",
    label: "Violet",
    swatch: "#7c3aed",
    accent: {
      primary: "#7c3aed",
      primaryFg: "#ffffff",
      chart1: "#7c3aed",
      chart2: "#8b5cf6",
      chart3: "#a78bfa",
      chart4: "#6d28d9",
      chart5: "#c4b5fd",
      ring: "#7c3aed",
    },
    surfaces: {
      light: {
        sidebar: "#ffffff",
        sidebarFg: "#1e293b",
        sidebarBorder: "#e2e8f0",
        sidebarAccent: "#f5f3ff",
        sidebarAccentFg: "#6d28d9",
        sidebarPrimary: "#7c3aed",
        sidebarPrimaryFg: "#ffffff",
      },
      dark: {
        sidebar: "#120a1f",
        sidebarFg: "#ddd6fe",
        sidebarBorder: "#2e1065",
        sidebarAccent: "#2e1065",
        sidebarAccentFg: "#c4b5fd",
        sidebarPrimary: "#8b5cf6",
        sidebarPrimaryFg: "#ffffff",
      },
    },
  },
];

export const DEFAULT_THEME_ID: SidebarThemeId = "blue";
export const DEFAULT_MODE: SidebarMode = "light";

export function getSidebarTheme(id: SidebarThemeId) {
  return SIDEBAR_THEMES.find((t) => t.id === id) ?? SIDEBAR_THEMES[0];
}

/** CSS variables for accent (app-wide) + sidebar surface (sidebar only). */
export function themeStyleVars(id: SidebarThemeId, mode: SidebarMode): Record<string, string> {
  const theme = getSidebarTheme(id);
  const surface = theme.surfaces[mode];
  return {
    "--primary": theme.accent.primary,
    "--primary-foreground": theme.accent.primaryFg,
    "--ring": theme.accent.ring,
    "--chart-1": theme.accent.chart1,
    "--chart-2": theme.accent.chart2,
    "--chart-3": theme.accent.chart3,
    "--chart-4": theme.accent.chart4,
    "--chart-5": theme.accent.chart5,
    "--sidebar": surface.sidebar,
    "--sidebar-foreground": surface.sidebarFg,
    "--sidebar-border": surface.sidebarBorder,
    "--sidebar-accent": surface.sidebarAccent,
    "--sidebar-accent-foreground": surface.sidebarAccentFg,
    "--sidebar-primary": surface.sidebarPrimary,
    "--sidebar-primary-foreground": surface.sidebarPrimaryFg,
  };
}
