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
  // Türkiye özel fiyatı: 3 USD / 150 TL — TR’de ana fiyat TL olarak görünür
  const trPriceUsd = "3 USD";
  const trPriceTl = "₺150";

  async function goPro() {
    setBusy(true);
    setMsg(null);
    try {
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
        {isTr && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <img
                src="/images/tr-flag.svg"
                alt="Türkiye"
                className="w-5 h-3.5"
                width={24}
                height={16}
              />
              <span className="text-sm font-bold text-teal-300 uppercase tracking-wider">
                Türkiye Özel Fiyatı
              </span>
            </div>
          </div>
        )}
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
          {t("pro_plan")} · {isTr ? `${trPriceTl} /ay` : "$5"}{t("per_month")}
        </p>
        <p className="mt-2 flex items-baseline gap-1">
          {isTr ? (
            <>
              <span className="text-5xl font-bold">{trPriceTl}</span>
              <span className="text-sm font-normal text-teal-400">{t("per_month")}</span>
            </>
          ) : (
            <>
              <span className="text-5xl font-bold">$5</span>
              <span className="text-sm font-normal text-slate-300">{t("per_month")}</span>
            </>
          )}
        </p>
        {isTr && (
          <p className="mt-1 text-xs text-teal-400">{trPriceUsd} / {t("per_month")}</p>
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
          {busy ? "…" : isTr ? `Pro'ya geç — ${trPriceTl}/ay` : t("go_pro")}
        </button>
        {msg ? <p className="mt-3 text-xs text-amber-200">{msg}</p> : null}
      </div>
    </div>
  );
}
