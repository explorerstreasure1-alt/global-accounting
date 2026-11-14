"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { LEMON_DIRECT_URL, LEMON_CHECKOUT_URL_TR } from "@/lib/billing";
import { I } from "./ui-icon";

export function ProBanner({ gun, email, country }: { gun: number; email: string; country?: string }) {
  const { t, locale } = useT();
  const [kapali, setKapali] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  if (kapali) return null;

  const isTr = locale === "tr" || country === "TR";
  const checkoutUrl = isTr ? LEMON_CHECKOUT_URL_TR : LEMON_DIRECT_URL;

  async function proOl() {
    setBusy(true);
    setHata(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, country: isTr ? "TR" : undefined }),
      });
      const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (json.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      window.location.href = checkoutUrl;
    } catch (e) {
      window.location.href = checkoutUrl;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 px-3 py-1.5 text-white shadow-lg sm:px-4 sm:py-2.5">
      <I name="spark" size={16} />
      <p className="text-xs font-medium sm:text-sm">{t("trial_msg").replace("{n}", String(Math.max(gun, 0)))}</p>
      {isTr ? (
        <span className="text-xs bg-teal-200/20 text-teal-100 px-2 py-0.5 rounded-full font-semibold">
          🇹🇷 3 USD / ₺150
        </span>
      ) : null}
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
        className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs hover:bg-white/25"
        aria-label="×"
      >
        <I name="close" size={12} />
      </button>
    </div>
  );
}
