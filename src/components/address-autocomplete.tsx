"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AddressSuggestion } from "@/lib/geoapify";

type Props = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  className?: string;
};

/**
 * Address field with Geoapify suggestions (via /api/address/autocomplete).
 * Falls back to a plain text input when the API key is not configured.
 */
export function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  placeholder = "Start typing a Canadian address…",
  required,
  disabled,
  autoComplete = "street-address",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  className = "input",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipFetchRef = useRef(false);

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/address/autocomplete?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const data = (await res.json().catch(() => ({}))) as {
          configured?: boolean;
          suggestions?: AddressSuggestion[];
        };
        if (data.configured === false) {
          setConfigured(false);
          setSuggestions([]);
          setOpen(false);
          return;
        }
        setConfigured(true);
        const next = data.suggestions || [];
        setSuggestions(next);
        setOpen(next.length > 0);
        setActiveIndex(next.length ? 0 : -1);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function choose(s: AddressSuggestion) {
    skipFetchRef.current = true;
    onChange(s.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      choose(suggestions[activeIndex]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className="address-autocomplete relative">
      <input
        id={id}
        name={name}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      {loading ? (
        <span className="address-autocomplete-status" aria-live="polite">
          Searching…
        </span>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="address-autocomplete-list"
          aria-label="Address suggestions"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`address-autocomplete-option${
                i === activeIndex ? " is-active" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="address-autocomplete-line1">
                {s.line1 || s.label}
              </span>
              {s.line2 ? (
                <span className="address-autocomplete-line2">{s.line2}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!configured ? (
        <span className="sr-only">
          Address autocomplete unavailable; enter address manually.
        </span>
      ) : null}
    </div>
  );
}
