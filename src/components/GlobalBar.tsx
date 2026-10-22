"use client";

import { useEffect, useState } from "react";
import { LOCALES, CURRENCIES, setLocale, setTheme, setCurrency, useT, type LocaleCode } from "@/lib/i18n";
import { I } from "./ui-icon";

/** Dil + para birimi seçici. Tema tekdir: fildişi defter (değiştirilemez). */
export function GlobalBar({ compact = false, userEmail }: { compact?: boolean; userEmail?: string }) {
  const [menu, setMenu] = useState(false);
  // Dil/para değerleri useT'den gelir: ülke tespiti (GeoLocale) bazı başka yerden
  // dile geçse seçiciler canlı güncellenir, artık yalnız onun state'i çoğul.
  const { t, locale, currency } = useT();

  useEffect(() => {
    // Tek tema: kâğıt defter kilitlidir.
    setTheme("notebook");
    document.documentElement.dataset.theme = "notebook";
  }, []);

  return (
    <div className={compact
      ? "no-print flex flex-wrap items-center gap-2 px-1 py-1.5"
      : "no-print flex flex-wrap items-center gap-2 rounded-[16px] bg-black/25 px-3 py-1.5 text-amber-50 backdrop-blur-md"}>
      <label className="flex items-center gap-1 text-xs">
        <I name="globe" size={14} className={compact ? "text-teal-700" : undefined} />
        <select
          value={locale}
          onChange={(e) => {
            const v = e.target.value as LocaleCode;
            // Kullanıcı elle seçti: kilidi devreye al, ülke tespiti artık ezmez.
            setLocale(v, { lock: true });
          }}
          className={compact
            ? "rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-teal-800 outline-none ring-1 ring-slate-300 hover:ring-teal-500 [&>option]:text-slate-900"
            : "rounded-full bg-white/10 px-2 py-1 text-xs outline-none [&>option]:text-slate-900"}
          title="Language / Dil / Язык"
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {!compact ? (
      <label className="flex items-center gap-1 text-xs">
        <span>💱</span>
        <select
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            // Kullanıcı para birimini elle seçti: dil/ülke artık ezmeyecek.
            try { window.localStorage.setItem("tailor-currency-lock", "1"); } catch { /* yoksay */ }
          }}
          className="rounded-full bg-white/10 px-2 py-1 text-xs outline-none [&>option]:text-slate-900"
          title="Currency / Para birimi"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      ) : null}
      {!compact ? (
      <span className="hidden text-[11px] text-amber-100/60 sm:inline">7 languages · RTL ready · Notebook</span>
      ) : null}
      {!compact && userEmail ? (
        <span className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-2 text-xs font-semibold outline-none hover:bg-white/20"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
              {(userEmail || "?").slice(0, 1).toLocaleUpperCase()}
            </span>
            <span className="max-w-[140px] truncate">{userEmail.split("@")[0]}</span>
            <I name="chevD" size={12} />
          </button>
          {menu ? (
            <span className="absolute right-0 top-full z-50 mt-1 block min-w-[180px] rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-900/10">
              <span className="block max-w-[220px] truncate px-3 py-1.5 text-xs text-slate-500">{userEmail}</span>
              <a href="/cikis" className="block rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                {t("mus_cikis")}
              </a>
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
