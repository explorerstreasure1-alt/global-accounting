"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

export function Pricing() {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function goPro() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (json.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setMsg(json.error || "Checkout unavailable — set Lemon keys in Vercel env.");
    } catch {
      setMsg("Checkout failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("free_plan")}</p>
        <p className="mt-2 text-4xl font-bold">$0</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>✓ Ledger + day/month close</li>
          <li>✓ Excel + backup</li>
          <li>✓ 7 languages</li>
        </ul>
        <a
          href="/app"
          className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {t("start_free")}
        </a>
      </div>
      <div className="rounded-3xl border-2 border-slate-900 bg-slate-900 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">{t("pro_plan")} · $3{t("per_month")}</p>
        <p className="mt-2 text-4xl font-bold">
          $3<span className="text-base font-normal text-slate-300">{t("per_month")}</span>
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          <li>✓ Everything in Starter</li>
          <li>✓ AI assistant (Groq + HuggingFace fallback)</li>
          <li>✓ Priority support for tailors</li>
        </ul>
        <button
          onClick={() => void goPro()}
          disabled={busy}
          className="mt-6 rounded-full bg-teal-300 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-teal-200 disabled:opacity-60"
        >
          {busy ? "…" : t("go_pro")}
        </button>
        {msg ? <p className="mt-3 text-xs text-amber-200">{msg}</p> : null}
      </div>
    </div>
  );
}
