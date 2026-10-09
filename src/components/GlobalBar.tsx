"use client";

import { useEffect, useState } from "react";
import { LOCALES, THEMES, CURRENCIES, getLocale, getTheme, setLocale, setTheme, getCurrency, setCurrency, type LocaleCode, type ThemeId } from "@/lib/i18n";
import { I } from "./ui-icon";

/** Dil + para birimi + tema seçici. Header'a gömülür, localStorage'da saklanır. compact: sadece dil (landing için). */
export function GlobalBar({ compact = false }: { compact?: boolean }) {
  const [locale, setLoc] = useState<LocaleCode>("en");
  const [theme, setTh] = useState<ThemeId>("notebook");
  const [currency, setCur] = useState<string>("USD");

  useEffect(() => {
    const l = getLocale();
    const th = getTheme();
    setLoc(l);
    setTh(th);
    setCur(getCurrency(l));
    setLocale(l);
    setTheme(th);
  }, []);

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-[16px] bg-black/25 px-3 py-1.5 text-amber-50 backdrop-blur-md">
      <label className="flex items-center gap-1 text-xs">
        <I name="globe" size={13} />
        <select
          value={locale}
          onChange={(e) => {
            const v = e.target.value as LocaleCode;
            setLoc(v);
            setLocale(v);
          }}
          className="rounded-full bg-white/10 px-2 py-1 text-xs outline-none [&>option]:text-slate-900"
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
        <I name="palette" size={13} />
        <select
          value={theme}
          onChange={(e) => {
            const v = e.target.value as ThemeId;
            setTh(v);
            setTheme(v);
          }}
          className="rounded-full bg-white/10 px-2 py-1 text-xs outline-none [&>option]:text-slate-900"
          title="Theme / Tema"
        >
          {THEMES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      ) : null}
      {!compact ? (
      <label className="flex items-center gap-1 text-xs">
        <span>💱</span>
        <select
          value={currency}
          onChange={(e) => {
            setCur(e.target.value);
            setCurrency(e.target.value);
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
      <span className="text-[11px] text-amber-100/60">7 languages · RTL ready · Pro themes</span>
      ) : null}
    </div>
  );
}
