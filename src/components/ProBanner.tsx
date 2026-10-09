"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { LEMON_DIRECT_URL } from "@/lib/billing";
import { I } from "./ui-icon";

export function ProBanner({ gun, email }: { gun: number; email: string }) {
  const { t } = useT();
  const [kapali, setKapali] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  if (kapali) return null;

  async function proOl() {
    setBusy(true);
    setHata(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (json.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      // API anahtarı bozuksa direkt ödeme linkine düş (webhook e-postayla eşler)
      window.location.href = LEMON_DIRECT_URL;
    } catch (e) {
      window.location.href = LEMON_DIRECT_URL;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 px-4 py-2.5 text-white shadow-lg">
      <I name="spark" size={16} />
      <p className="text-sm font-medium">{t("trial_msg").replace("{n}", String(Math.max(gun, 0)))}</p>
      <button
        onClick={() => void proOl()}
        disabled={busy}
        className="ml-auto rounded-full bg-white px-4 py-1.5 text-xs font-bold text-teal-800 disabled:opacity-60"
      >
        {busy ? "…" : t("trial_btn")}
      </button>
      {hata ? <p className="w-full text-[11px] text-amber-200">{hata}</p> : null}
      <button
        onClick={() => setKapali(true)}
        className="grid h-6 w-6 place-items-center rounded-full bg-white/15 text-xs hover:bg-white/25"
        aria-label="×"
      >
        <I name="close" size={12} />
      </button>
    </div>
  );
}
