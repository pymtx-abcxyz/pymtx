"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppearanceSettingSection } from "@/components/appearance-setting-section";
import { PymtxLogotype } from "@/components/pymtx-mark";

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

/**
 * Landing chrome — mobile: logo + Sign in + hamburger sheet.
 * Desktop: logo + Sign in + Register + appearance.
 *
 * Sheet portals to document.body so portal-nav backdrop-filter cannot
 * trap/composite it as translucent over hero text.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) triggerRef.current?.blur();
  }, [open]);

  const sheet =
    mounted &&
    createPortal(
      <div
        className={`fixed inset-0 z-50 sm:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
        hidden={!open}
      >
        <button
          type="button"
          className={`absolute inset-0 z-0 bg-black/50 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Dismiss menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute right-0 top-0 z-10 flex h-full w-[min(20rem,88vw)] flex-col border-l border-border-subtle shadow-lg transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
          style={{
            // Fully opaque canvas — never inherit translucent nav material.
            backgroundColor: "var(--canvas)",
          }}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
            <span className="text-[length:var(--text-sm)] font-semibold leading-none text-text-primary">
              Menu
            </span>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-text-secondary shadow-none hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <MenuIcon open />
            </button>
          </div>

          <nav
            className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
            aria-label="Mobile"
          >
            <Link
              href="/register"
              className="flex min-h-[44px] items-center rounded-md px-3 text-[length:var(--text-base)] font-medium text-text-primary hover:bg-surface-subtle"
              onClick={() => setOpen(false)}
            >
              Register
            </Link>
            <Link
              href="/login"
              className="flex min-h-[44px] items-center rounded-md px-3 text-[length:var(--text-base)] font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              onClick={() => setOpen(false)}
            >
              Merchant sign in
            </Link>
            <Link
              href="/login/customer"
              className="flex min-h-[44px] items-center rounded-md px-3 text-[length:var(--text-base)] font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              onClick={() => setOpen(false)}
            >
              Customer sign in
            </Link>

            <div className="mt-4 border-t border-border-subtle pt-4">
              <p className="mb-2 px-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Appearance
              </p>
              <div className="px-3">
                <AppearanceSettingSection compact />
              </div>
            </div>
          </nav>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <header className="portal-nav sticky top-0 z-30">
        <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-3">
          <Link
            href="/"
            className="text-[length:var(--text-xl)] text-text-primary"
            aria-label="pymtx home"
          >
            <PymtxLogotype />
          </Link>

          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center px-2 text-[length:var(--text-sm)] font-medium text-text-secondary hover:text-text-primary sm:px-3"
            >
              Sign in
            </Link>

            <div className="hidden items-center gap-3 sm:flex">
              <AppearanceSettingSection compact />
              <Link href="/register" className="btn-ghost btn-toolbar">
                Register
              </Link>
            </div>

            <button
              ref={triggerRef}
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-text-primary hover:text-text-secondary sm:hidden"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>
      {sheet}
    </>
  );
}
