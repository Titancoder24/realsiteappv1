"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME_ID,
  type SidebarThemeId,
  getSidebarTheme,
} from "@/lib/theme/sidebar-themes";

const STORAGE_KEY = "spatial-sales-sidebar-theme";

export function useSidebarTheme() {
  const [themeId, setThemeIdState] = useState<SidebarThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as SidebarThemeId | null;
    if (stored && getSidebarTheme(stored)) setThemeIdState(stored);
    setReady(true);
  }, []);

  const setThemeId = useCallback((id: SidebarThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { themeId, setThemeId, theme: getSidebarTheme(themeId), ready };
}
