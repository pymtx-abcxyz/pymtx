"use client";

import {
  descriptionForTheme,
  iconNameForTheme,
  titleForTheme,
  type AppTheme,
} from "@/lib/appearance";
import { useAppearance } from "@/components/appearance-provider";

function ThemeGlyph({ theme }: { theme: AppTheme }) {
  const name = iconNameForTheme(theme);
  const common = {
    className: "h-5 w-5",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true as const,
  };

  if (name === "sun.max.fill") {
    return (
      <svg {...common}>
        <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 17.5a1 1 0 0 1 1 1V22a1 1 0 1 1-2 0v-1.5a1 1 0 0 1 1-1ZM3 11a1 1 0 0 1 1-1h1.5a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm15.5 0a1 1 0 0 1 1-1H21a1 1 0 1 1 0 2h-1.5a1 1 0 0 1-1-1ZM5.05 5.05a1 1 0 0 1 1.41 0l1.06 1.06a1 1 0 1 1-1.41 1.41L5.05 6.46a1 1 0 0 1 0-1.41Zm11.43 11.43a1 1 0 0 1 1.41 0l1.06 1.06a1 1 0 0 1-1.41 1.41l-1.06-1.06a1 1 0 0 1 0-1.41ZM18.95 5.05a1 1 0 0 1 0 1.41l-1.06 1.06a1 1 0 1 1-1.41-1.41l1.06-1.06a1 1 0 0 1 1.41 0ZM7.52 16.48a1 1 0 0 1 0 1.41L6.46 18.95a1 1 0 0 1-1.41-1.41l1.06-1.06a1 1 0 0 1 1.41 0Z" />
      </svg>
    );
  }

  if (name === "moon.fill") {
    return (
      <svg {...common}>
        <path d="M21 14.3A9 9 0 0 1 9.7 3a7.5 7.5 0 1 0 11.3 11.3Z" />
      </svg>
    );
  }

  /* circle.righthalf.filled */
  return (
    <svg {...common}>
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2v16a8 8 0 0 0 0-16Z"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      className="h-5 w-5 text-action-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * HIG appearance control — list with SF Symbol analogues + checkmarks
 * (SwiftUI AppearanceSettingSection Option B).
 */
export function AppearanceSettingSection({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { theme, setTheme, themes } = useAppearance();

  if (compact) {
    return (
      <div
        className="appearance-segment"
        role="radiogroup"
        aria-label="Appearance"
      >
        {themes.map((option) => {
          const selected = option === theme;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={titleForTheme(option)}
              title={titleForTheme(option)}
              className={`appearance-segment-option ${selected ? "is-selected" : ""}`}
              onClick={() => setTheme(option)}
            >
              <ThemeGlyph theme={option} />
              <span className="sr-only">{titleForTheme(option)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="section-block max-w-xl" aria-label="Appearance">
      <div>
        <h2 className="font-display text-[length:var(--text-2xl)] font-bold text-text-primary">
          Appearance
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] text-text-muted">
          Choose System to follow your device, or lock Light / Dark.
        </p>
      </div>
      <ul className="appearance-list mt-4" role="radiogroup" aria-label="Appearance theme">
        {themes.map((option) => {
          const selected = option === theme;
          return (
            <li key={option}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={`appearance-row ${selected ? "is-selected" : ""}`}
                onClick={() => setTheme(option)}
              >
                <span className="appearance-icon" aria-hidden>
                  <ThemeGlyph theme={option} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold text-text-primary">
                    {titleForTheme(option)}
                  </span>
                  <span className="mt-0.5 block text-[length:var(--text-sm)] text-text-muted">
                    {descriptionForTheme(option)}
                  </span>
                </span>
                <span className="appearance-check" aria-hidden>
                  {selected ? <CheckGlyph /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
