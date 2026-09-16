"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  APP_THEMES,
  AppTheme,
  applyThemeToDocument,
  readStoredTheme,
  writeStoredTheme,
  type AppTheme as AppThemeType,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: AppThemeType;
  setTheme: (theme: AppThemeType) => void;
  themes: readonly AppThemeType[];
  /** Resolved scheme for previews / chrome (never null after mount). */
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
  const [theme, setThemeState] = useState<AppThemeType>(AppTheme.system);
  const [hydrated, setHydrated] = useState(false);
  const systemScheme = useSyncExternalStore(
    subscribeSystemScheme,
    getSystemSchemeSnapshot,
    getServerSchemeSnapshot,
  );

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeToDocument(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyThemeToDocument(theme);
  }, [theme, hydrated]);

  const setTheme = useCallback((next: AppThemeType) => {
    setThemeState(next);
    writeStoredTheme(next);
    applyThemeToDocument(next);
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
