"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { I } from "./ui-icon";
import { LEMON_CHECKOUT_URL_TR } from "@/lib/billing";

const LEMON_CHECKOUT_URL =
  process.env.NEXT_PUBLIC_LEMON_CHECKOUT_URL ||
  "https://projeai.lemonsqueezy.com/checkout/buy/28a3f3c5-4f04-4a74-98df-bc8e7caa1f82";

export function Pricing() {
  const { t, locale } = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isTr = locale === "tr";
  // Türkiye özel fiyatı: 3 USD / 150 TL
  const trPriceRaw = "3";
  const trPriceSymbol = "USD";
  const trPriceLocal = "₺150";

  async function goPro() {
    setBusy(true);
    setMsg(null);
    try {
      // Önce API checkout (user_id işlenir → webhook Pro'yu doğru hesaba açar)
      let email: string | undefined;
      let userId: string | undefined;
      if (supabaseConfigured()) {
        try {
          const supa = createClient();
          const { data: { user } } = await supa.auth.getUser();
          email = user?.email ?? undefined;
          userId = user?.id;
        } catch { /* misafir devam */ }
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, userId, locale, country: isTr ? "TR" : undefined }),
      });
      const json = (await res.json()) as { ok: boolean; url?: string };
      if (json.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      // API yoksa ülkeye göre direkt linke düş
      window.location.href = isTr ? LEMON_CHECKOUT_URL_TR : LEMON_CHECKOUT_URL;
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
        <p className="mt-2 text-4xl font-bold">{isTr ? "₺0" : "$0"}</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2"><I name="check" size={14} /> {t("price_s1")}</li>
          <li className="flex items-center gap-2"><I name="check" size={14} /> {t("price_s2")}</li>
          <li className="flex items-center gap-2"><I name="check" size={14} /> {t("price_s3")}</li>
        </ul>
        <a
          href="/app"
          className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {t("start_free")}
        </a>
      </div>
      <div className="rounded-3xl border-2 border-slate-900 bg-slate-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-1 mb-1">
          {isTr && <span className="text-xs font-bold text-teal-300">🇹🇷 Türkiye Özel Fiyatı</span>}
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
          {t("pro_plan")} · {isTr ? `${trPriceRaw} ${trPriceSymbol} (${trPriceLocal})` : "$5"}{t("per_month")}
        </p>
        <p className="mt-2 text-4xl font-bold">
          {isTr ? `${trPriceRaw} ${trPriceSymbol}` : "$5"}<span className="text-base font-normal text-slate-300">{t("per_month")}</span>
        </p>
        {isTr && (
          <p className="mt-1 text-xs text-teal-400">{trPriceLocal}</p>
        )}
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          <li className="flex items-center gap-2"><I name="check" size={14} /> {t("price_p1")}</li>
          <li className="flex items-center gap-2"><I name="check" size={14} /> {t("price_p2")}</li>
          <li className="flex items-center gap-2"><I name="check" size={14} /> {t("price_p3")}</li>
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
