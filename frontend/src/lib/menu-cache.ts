import type { MenuItem } from "@/lib/types";

const MENU_CACHE_KEY = "corp_menu_cache";

export function getCachedMenus(): MenuItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MenuItem[]) : [];
  } catch {
    return [];
  }
}

export function setCachedMenus(menus: MenuItem[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menus));
}

export function clearCachedMenus(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(MENU_CACHE_KEY);
}
