"use client";

import { useEffect, useState } from "react";
import {
  deriveOnboarding,
  onboardingDismissKey,
  onboardingInviteSharedKey,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { SectionTitle, StatusPill } from "@/components/ui";

type Props = {
  businessId: string;
  stripeOnboardingComplete: boolean;
  invoiceCount: number;
  inviteHref: string | null;
  canConnect: boolean;
  busy?: boolean;
  /** Emphasize after fresh registration. */
  welcome?: boolean;
  onConnect: () => void;
  onUploadSample: () => void;
  onOpenCsvPicker: () => void;
};

export function OnboardingChecklist({
  businessId,
  stripeOnboardingComplete,
  invoiceCount,
  inviteHref,
  canConnect,
  busy = false,
  welcome = false,
  onConnect,
  onUploadSample,
  onOpenCsvPicker,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [inviteShared, setInviteShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const snap = deriveOnboarding({
    stripeOnboardingComplete,
    invoiceCount,
    hasInviteLink: Boolean(inviteHref),
    inviteShared,
    canConnect,
  });

  useEffect(() => {
    try {
      setDismissed(
        window.localStorage.getItem(onboardingDismissKey(businessId)) === "1",
      );
      setInviteShared(
        window.localStorage.getItem(onboardingInviteSharedKey(businessId)) ===
          "1",
      );
    } catch {
      setDismissed(false);
      setInviteShared(false);
    }
    setHydrated(true);
  }, [businessId]);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(onboardingDismissKey(businessId), "1");
    } catch {
      /* ignore quota / private mode */
    }
  }

  function markInviteShared() {
    setInviteShared(true);
    try {
      window.localStorage.setItem(onboardingInviteSharedKey(businessId), "1");
    } catch {
      /* ignore */
    }
  }

  async function copyInvite() {
    if (!inviteHref) return;
    const absolute =
      typeof window !== "undefined"
        ? new URL(inviteHref, window.location.origin).toString()
        : inviteHref;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      markInviteShared();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      markInviteShared();
      window.open(inviteHref, "_blank", "noopener,noreferrer");
    }
  }

  if (!hydrated) return null;
  if (dismissed && !welcome) return null;
  if (snap.complete && dismissed) return null;

  return (
    <section
      className={`onboarding-checklist mb-10 animate-rise ${welcome ? "onboarding-checklist-welcome" : ""}`}
      aria-label="Setup checklist"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          title={
            snap.complete
              ? "You're ready to collect"
              : welcome
                ? "Welcome — finish setup"
                : "Get ready to collect"
          }
          subtitle={
            snap.complete
              ? "Bank connected, receivables uploaded, and a PAD invite ready to share."
              : "Three steps. Principal stays with you — Pymtx only takes an application fee."
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone={snap.complete ? "success" : "warning"}>
            {snap.doneCount}/{snap.total} done
          </StatusPill>
          {(snap.complete || snap.doneCount > 0) && (
            <button
              type="button"
              className="btn-ghost !px-3 !py-2 text-[length:var(--text-sm)]"
              onClick={dismiss}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      <ol className="onboarding-steps mt-6">
        {snap.steps.map((step, index) => {
          const isCurrent = snap.currentId === step.id;
          return (
            <li
              key={step.id}
              className={[
                "onboarding-step",
                step.done ? "is-done" : "",
                isCurrent ? "is-current" : "",
                step.locked ? "is-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="onboarding-step-index" aria-hidden>
                {step.done ? "✓" : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-display text-[length:var(--text-lg)] font-bold text-text-primary">
                    {step.title}
                    {step.done ? (
                      <span className="sr-only"> (completed)</span>
                    ) : null}
                    {step.locked ? (
                      <span className="sr-only"> (locked)</span>
                    ) : null}
                  </p>
                  {step.done ? (
                    <StatusPill tone="success">Done</StatusPill>
                  ) : isCurrent ? (
                    <StatusPill tone="warning">Next</StatusPill>
                  ) : step.locked ? (
                    <StatusPill>Locked</StatusPill>
                  ) : null}
                </div>
                <p className="mt-1 text-[length:var(--text-sm)] leading-relaxed text-text-secondary">
                  {step.description}
                </p>
                {!step.done && !step.locked ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StepActions
                      id={step.id}
                      isCurrent={isCurrent}
                      canConnect={canConnect}
                      busy={busy}
                      inviteHref={inviteHref}
                      copied={copied}
                      onConnect={onConnect}
                      onUploadSample={onUploadSample}
                      onOpenCsvPicker={onOpenCsvPicker}
                      onCopyInvite={copyInvite}
                      onOpenInvite={markInviteShared}
                    />
                  </div>
                ) : null}
                {step.id === "invite" && step.done && inviteHref ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="btn-ghost !py-2 text-[length:var(--text-sm)]"
                      href={inviteHref}
                    >
                      Open invite
                    </a>
                    <button
                      type="button"
                      className="btn-ghost !py-2 text-[length:var(--text-sm)]"
                      onClick={copyInvite}
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepActions({
  id,
  isCurrent,
  canConnect,
  busy,
  inviteHref,
  copied,
  onConnect,
  onUploadSample,
  onOpenCsvPicker,
  onCopyInvite,
  onOpenInvite,
}: {
  id: OnboardingStepId;
  isCurrent: boolean;
  canConnect: boolean;
  busy: boolean;
  inviteHref: string | null;
  copied: boolean;
  onConnect: () => void;
  onUploadSample: () => void;
  onOpenCsvPicker: () => void;
  onCopyInvite: () => void;
  onOpenInvite: () => void;
}) {
  const primary = isCurrent ? "btn-primary" : "btn-ghost";
  const size = `${primary} !py-2 text-[length:var(--text-sm)]`;

  if (id === "connect") {
    if (!canConnect) {
      return (
        <a className="btn-ghost !py-2 text-[length:var(--text-sm)]" href="/business/settings">
          Open settings
        </a>
      );
    }
    return (
      <button
        type="button"
        className={size}
        disabled={busy}
        onClick={onConnect}
        aria-busy={busy}
      >
        Connect Canadian bank
      </button>
    );
  }

  if (id === "upload") {
    return (
      <>
        <button
          type="button"
          className={size}
          disabled={busy}
          onClick={onOpenCsvPicker}
          aria-busy={busy}
        >
          Upload CSV
        </button>
        <button
          type="button"
          className="btn-ghost !py-2 text-[length:var(--text-sm)]"
          disabled={busy}
          onClick={onUploadSample}
          aria-busy={busy}
        >
          Quick sample invite
        </button>
      </>
    );
  }

  return (
    <>
      {inviteHref ? (
        <a className={size} href={inviteHref} onClick={onOpenInvite}>
          Open invite
        </a>
      ) : null}
      <button
        type="button"
        className="btn-ghost !py-2 text-[length:var(--text-sm)]"
        disabled={!inviteHref}
        onClick={onCopyInvite}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </>
  );
}
