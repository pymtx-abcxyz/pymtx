"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  APP_THEMES,
  AppTheme,
  commitTheme,
  getServerThemeSnapshot,
  getThemeStoreSnapshot,
  subscribeThemeStore,
  type AppTheme as AppThemeType,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: AppThemeType;
  setTheme: (theme: AppThemeType) => void;
  themes: readonly AppThemeType[];
  /** Resolved scheme for chrome (never null). */
  resolvedScheme: "light" | "dark";
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function subscribeSystemScheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSystemSchemeSnapshot(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getServerSchemeSnapshot(): "light" | "dark" {
  return "light";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeThemeStore,
    getThemeStoreSnapshot,
    getServerThemeSnapshot,
  );
  const systemScheme = useSyncExternalStore(
    subscribeSystemScheme,
    getSystemSchemeSnapshot,
    getServerSchemeSnapshot,
  );

  const setTheme = useCallback((next: AppThemeType) => {
    commitTheme(next);
  }, []);

  const resolvedScheme: "light" | "dark" =
    theme === AppTheme.system
      ? systemScheme
      : theme === AppTheme.dark
        ? "dark"
        : "light";

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: APP_THEMES,
      resolvedScheme,
    }),
    [theme, setTheme, resolvedScheme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
