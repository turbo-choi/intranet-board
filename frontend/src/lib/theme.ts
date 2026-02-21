export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "corp_theme";

export function normalizeTheme(value: string | null | undefined): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("theme-light", theme === "light");
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function persistTheme(theme: ThemeMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
