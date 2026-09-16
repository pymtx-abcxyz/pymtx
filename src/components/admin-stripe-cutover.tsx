"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SectionTitle,
  Metric,
  StatusPill,
  FormNotice,
  FormError,
} from "@/components/ui";

type StripeSetup = {
  mode: string;
  publishableKey: string | null;
  publishableMode: string;
  webhookConfigured: boolean;
  webhookUrl: string;
  account: {
    id: string;
    country: string | null;
    charges_enabled: boolean;
  } | null;
  accountError?: string;
  connectPlatform: "ready" | "not_registered" | "unknown";
  connectPlatformDetail?: string;
};

type PostResult = {
  created: boolean;
  endpointId: string;
  webhookUrl: string;
  webhookSecret: string | null;
  hint: string;
};

export function AdminStripeCutover() {
  const [data, setData] = useState<StripeSetup | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secretOnce, setSecretOnce] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/admin/stripe-setup");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not load Stripe cutover status");
      return;
    }
    setData(json as StripeSetup);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureWebhook() {
    setBusy(true);
    setError("");
    setNotice("");
    setSecretOnce("");
    try {
      const res = await fetch("/api/admin/stripe-setup", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as PostResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not ensure Connect webhook");
        return;
      }
      if (json.webhookSecret) {
        setSecretOnce(json.webhookSecret);
        setNotice(json.hint);
      } else {
        setNotice(json.hint || "Connect webhook endpoint already exists.");
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!secretOnce) return;
    try {
      await navigator.clipboard.writeText(secretOnce);
      setNotice("Signing secret copied — set it on Vercel, then redeploy.");
    } catch {
      setError("Could not copy — select the secret manually.");
    }
  }

  const platformTone =
    data?.connectPlatform === "ready"
      ? "success"
      : data?.connectPlatform === "not_registered"
        ? "danger"
        : "warning";

  return (
    <section className="section-block">
      <SectionTitle
        title="Stripe cutover"
        subtitle="Ping the platform account, Connect profile, and Connect webhook endpoint — no secret values in GET."
      />

      {error ? (
        <div className="mt-4">
          <FormError id="admin-stripe-error">{error}</FormError>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4">
          <FormNotice id="admin-stripe-notice" tone="warning">
            {notice}
          </FormNotice>
        </div>
      ) : null}
      {secretOnce ? (
        <div className="mt-4">
          <FormNotice tone="warning">
            <span className="block text-[length:var(--text-sm)] font-semibold text-text-primary">
              One-time webhook signing secret
            </span>
            <p className="mt-2 break-all font-mono text-[length:var(--text-xs)] text-text-secondary">
              {secretOnce}
            </p>
            <button
              type="button"
              className="btn-secondary btn-toolbar mt-3"
              onClick={copySecret}
            >
              Copy secret
            </button>
          </FormNotice>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Key mode"
          value={data?.mode ?? "…"}
          hint={
            data?.publishableMode
              ? `Publishable: ${data.publishableMode}`
              : "Loading…"
          }
          size="md"
        />
        <div className="metric-tile">
          <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Connect platform
          </div>
          <div className="mt-2">
            {data ? (
              <StatusPill tone={platformTone}>
                {data.connectPlatform === "ready"
                  ? "Ready"
                  : data.connectPlatform === "not_registered"
                    ? "Not registered"
                    : "Unknown"}
              </StatusPill>
            ) : (
              <span className="text-text-muted">…</span>
            )}
          </div>
          {data?.connectPlatformDetail ? (
            <p className="mt-2 text-[length:var(--text-xs)] text-text-secondary">
              {data.connectPlatformDetail}
            </p>
          ) : null}
        </div>
        <div className="metric-tile">
          <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Webhook
          </div>
          <div className="mt-2">
            {data ? (
              <StatusPill tone={data.webhookConfigured ? "success" : "warning"}>
                {data.webhookConfigured ? "Configured" : "Missing"}
              </StatusPill>
            ) : (
              <span className="text-text-muted">…</span>
            )}
          </div>
          {data?.webhookUrl ? (
            <p className="mt-2 break-all text-[length:var(--text-xs)] text-text-secondary">
              {data.webhookUrl}
            </p>
          ) : null}
        </div>
        <Metric
          label="Platform account"
          value={
            data?.account?.id
              ? data.account.charges_enabled
                ? "Charges on"
                : "Charges off"
              : data?.accountError
                ? "Error"
                : "…"
          }
          hint={
            data?.account
              ? `${data.account.id}${data.account.country ? ` · ${data.account.country}` : ""}`
              : data?.accountError || "Stripe account ping"
          }
          size="md"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary btn-toolbar"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="btn-primary btn-toolbar"
          disabled={busy}
          onClick={() => void ensureWebhook()}
        >
          {busy ? "Working…" : "Ensure Connect webhook"}
        </button>
      </div>
    </section>
  );
}
