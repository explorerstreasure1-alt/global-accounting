"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { LEMON_DIRECT_URL, LEMON_CHECKOUT_URL_TR } from "@/lib/billing";
import { I } from "./ui-icon";

export function KilitEkrani({
  trialLeft,
  email,
  businessName,
  country,
}: {
  trialLeft: number;
  email: string;
  businessName: string;
  country?: string;
}) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

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
    <div className="grid min-h-screen place-items-center bg-[#f4f4f2] p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Shop Ledger · Pro</p>
        <h1 className="mt-2 text-3xl font-extrabold">{t("kilit_title")}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("kilit_sub").replace("{b}", businessName)}
          {trialLeft < 0 ? ` (${Math.abs(trialLeft)})` : ""}
        </p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-4xl font-extrabold">
            {isTr ? "3 USD" : "$5"}
            <span className="text-base font-normal text-slate-500">{t("kilit_per")}</span>
          </p>
          {isTr ? (
            <>
              <p className="mt-1 text-xs text-teal-600 font-semibold">🇹🇷 ₺150 / ay</p>
              <p className="mt-1 text-xs text-teal-600 font-semibold">{t("tr_special_price")}</p>
            </>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">{t("kilit_feat")}</p>
        </div>
        {hata ? <p className="mt-2 text-xs text-rose-700">{hata}</p> : null}
        <button
          onClick={proOl}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : t("kilit_btn")}
        </button>
        <a href="/cikis" className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 underline">
          <I name="close" size={12} /> {t("kilit_alt")}
        </a>
      </div>
    </div>
  );
}
