"use client";

import { useState } from "react";
import { I } from "./ui-icon";

export function KilitEkrani({ trialLeft, email, businessName }: { trialLeft: number; email: string; businessName: string }) {
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

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
      if (!json.ok || !json.url) throw new Error(json.error || "Checkout açılamadı");
      window.location.href = json.url;
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Ödeme sayfası açılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-900 to-slate-800 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Shop Ledger · Pro</p>
        <h1 className="mt-2 text-3xl font-extrabold">Deneme süreniz doldu</h1>
        <p className="mt-2 text-sm text-slate-600">
          <b>{businessName}</b> için 5 günlük ücretsiz deneme{trialLeft < 0 ? ` ${Math.abs(trialLeft)} gün önce` : ""} bitti.
          Defteriniz, kayıtlarınız ve raporlarınız aynen duruyor — Pro ile devam edin.
        </p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-4xl font-extrabold">$3<span className="text-base font-normal text-slate-500">/ay</span></p>
          <p className="mt-1 text-xs text-slate-500">Sınırsız kayıt · Word/Excel/PDF · Yedek</p>
        </div>
        {hata ? <p className="mt-2 text-xs text-rose-700">{hata}</p> : null}
        <button
          onClick={proOl}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Pro'ya geç — kilidi aç"}
        </button>
        <a href="/cikis" className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 underline">
          <I name="close" size={12} /> Farklı hesapla giriş yap
        </a>
      </div>
    </div>
  );
}
