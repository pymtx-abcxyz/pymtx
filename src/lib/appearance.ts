/**
 * Appearance management — web analogue of Apple HIG ThemeManager / AppTheme.
 * Persists like @AppStorage("app_appearance_theme"); `system` defers to OS.
 */

export const APP_THEME_STORAGE_KEY = "app_appearance_theme";

export const AppTheme = {
  system: "system",
  light: "light",
  dark: "dark",
} as const;

export type AppTheme = (typeof AppTheme)[keyof typeof AppTheme];

export const APP_THEMES: AppTheme[] = [
  AppTheme.system,
  AppTheme.light,
  AppTheme.dark,
];

/** SwiftUI ColorScheme? — null means follow the system. */
export type ColorSchemePreference = "light" | "dark" | null;

export function colorSchemeForTheme(theme: AppTheme): ColorSchemePreference {
  if (theme === AppTheme.system) return null;
  return theme;
}

/** SF Symbol name analogues for UI affordances. */
export function iconNameForTheme(theme: AppTheme): string {
  switch (theme) {
    case AppTheme.system:
      return "circle.righthalf.filled";
    case AppTheme.light:
      return "sun.max.fill";
    case AppTheme.dark:
      return "moon.fill";
  }
}

export function titleForTheme(theme: AppTheme): string {
  switch (theme) {
    case AppTheme.system:
      return "System";
    case AppTheme.light:
      return "Light";
    case AppTheme.dark:
      return "Dark";
  }
}

export function descriptionForTheme(theme: AppTheme): string {
  switch (theme) {
    case AppTheme.system:
      return "Match your device appearance";
    case AppTheme.light:
      return "Always use light appearance";
    case AppTheme.dark:
      return "Always use dark appearance";
  }
}

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    value === AppTheme.system ||
    value === AppTheme.light ||
    value === AppTheme.dark
  );
}

export function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return AppTheme.system;
  try {
    const raw = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    return isAppTheme(raw) ? raw : AppTheme.system;
  } catch {
    return AppTheme.system;
  }
}

export function writeStoredTheme(theme: AppTheme) {
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode / blocked storage */
  }
}

/** Apply `data-theme` + `color-scheme` on <html> (preferredColorScheme wiring). */
export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  const scheme = colorSchemeForTheme(theme);
  root.style.colorScheme = scheme ?? "light dark";
}

/**
 * Inline boot script — runs before paint to avoid FOUC (system/light/dark).
 * Keep in sync with APP_THEME_STORAGE_KEY / AppTheme values.
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(APP_THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t==="system"?"light dark":t;}catch(e){document.documentElement.dataset.theme="system";document.documentElement.style.colorScheme="light dark";}})();`;
