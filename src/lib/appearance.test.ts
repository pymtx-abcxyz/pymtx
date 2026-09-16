import { describe, expect, it } from "vitest";
import {
  APPEARANCE_BOOT_SCRIPT,
  APP_THEME_STORAGE_KEY,
  AppTheme,
  colorSchemeForTheme,
  iconNameForTheme,
  isAppTheme,
  titleForTheme,
} from "./appearance";

describe("appearance ThemeManager", () => {
  it("maps system to nil color scheme (follow device)", () => {
    expect(colorSchemeForTheme(AppTheme.system)).toBeNull();
    expect(colorSchemeForTheme(AppTheme.light)).toBe("light");
    expect(colorSchemeForTheme(AppTheme.dark)).toBe("dark");
  });

  it("exposes SF Symbol name analogues", () => {
    expect(iconNameForTheme(AppTheme.system)).toBe("circle.righthalf.filled");
    expect(iconNameForTheme(AppTheme.light)).toBe("sun.max.fill");
    expect(iconNameForTheme(AppTheme.dark)).toBe("moon.fill");
  });

  it("provides localized-ready titles", () => {
    expect(titleForTheme(AppTheme.system)).toBe("System");
    expect(titleForTheme(AppTheme.light)).toBe("Light");
    expect(titleForTheme(AppTheme.dark)).toBe("Dark");
  });

  it("validates stored theme values", () => {
    expect(isAppTheme("system")).toBe(true);
    expect(isAppTheme("light")).toBe(true);
    expect(isAppTheme("dark")).toBe(true);
    expect(isAppTheme("neon")).toBe(false);
  });

  it("boot script stays aligned with storage key and cookie write", () => {
    expect(APPEARANCE_BOOT_SCRIPT).toContain(APP_THEME_STORAGE_KEY);
    expect(APPEARANCE_BOOT_SCRIPT).toContain("dataset.theme");
    expect(APPEARANCE_BOOT_SCRIPT).toContain("document.cookie");
    expect(APPEARANCE_BOOT_SCRIPT).toContain("colorScheme");
  });
});
