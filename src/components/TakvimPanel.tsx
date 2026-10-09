"use client";

import { useMemo, useState } from "react";
import type { Kayit } from "@/lib/types";
import { formatMoneyLocale, formatDate, monthPrefix, toISODate, getMonthNames, getWeekdayNames } from "@/lib/format";
import { I } from "./ui-icon";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  kayitlar: Kayit[];
  year: number;
  month: number;
  onClose: () => void;
  /** Takvimden tarih seçilince: defteri o aya götür + o güne kayıt yazmaya hazırla */
  onPickDate: (iso: string) => void;
  /** İki tarih seçilince Z raporu aralığı kur */
  onPickRange: (bas: string, bit: string) => void;
  /** Kayıtlar değişince (toplu silme) üst listeyi tazele */
  onChanged?: () => void;
};

const HAFTA_FALLBACK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TakvimPanel({ open, kayitlar, year, month, onClose, onPickDate, onPickRange, onChanged }: Props) {
  const { t, intl, currency } = useT();
  const fm = (v: number, sym = true) => formatMoneyLocale(v, intl, currency, sym);
  const fd = (iso: string) => formatDate(iso, intl);
  const monthNames = getMonthNames(intl);
  const HAFTA = getWeekdayNames(intl, true);
  const [silAdet, setSilAdet] = useState<number | null>(null);
  const [silYapiliyor, setSilYapiliyor] = useState(false);

  async function topluSil(onayla: boolean) {
    if (!aralikBas || !aralikBit) return;
    setSilYapiliyor(true);
    try {
      const res = await fetch("/api/toplu-sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baslangic: aralikBas, bitis: aralikBit, onayla }),
      });
      const json = (await res.json()) as { ok?: boolean; preview?: boolean; adet?: number; silinen?: number };
      if (!res.ok || !json.ok) {
        setSilAdet(null);
        return;
      }
      if (json.preview) {
        setSilAdet(json.adet ?? 0);
      } else {
        setSilAdet(null);
        onChanged?.();
        onClose();
      }
    } catch {
      setSilAdet(null);
    } finally {
      setSilYapiliyor(false);
    }
  }
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const [secili, setSecili] = useState<string>(toISODate());
  const [aralikBas, setAralikBas] = useState<string>("");
  const [aralikBit, setAralikBit] = useState<string>("");

  const gunluk = useMemo(() => {
    const map = new Map<string, { gelir: number; gider: number; adet: number }>();
    for (const k of kayitlar) {
      const v = map.get(k.tarih) ?? { gelir: 0, gider: 0, adet: 0 };
      v.gelir += k.gelir;
      v.gider += k.gider;
      v.adet += 1;
      map.set(k.tarih, v);
    }
    return map;
  }, [kayitlar]);

  const hucreler = useMemo(() => {
    const ilk = new Date(y, m - 1, 1);
    // Pazartesi başlangıçlı
    const baslangicBosluk = (ilk.getDay() + 6) % 7;
    const gunSayisi = new Date(y, m, 0).getDate();
    const arr: Array<string | null> = [];
    for (let i = 0; i < baslangicBosluk; i += 1) arr.push(null);
    for (let g = 1; g <= gunSayisi; g += 1) {
      arr.push(`${y}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`);
    }
    return arr;
  }, [y, m]);

  if (!open) return null;

  const yillar = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - 10 + i);

  function gitBugun() {
    const t = new Date();
    setY(t.getFullYear());
    setM(t.getMonth() + 1);
    setSecili(toISODate(t));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-3">
      <div className="my-4 w-full max-w-3xl rounded-2xl bg-[#fbf6ea] text-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 px-5 py-3">
          <div className="mr-auto">
            <p className="font-hand inline-flex items-center gap-2 text-3xl leading-none"><I name="calendar" size={26} /> {t("cal_title")}</p>
            <p className="text-xs text-slate-600">{t("cal_sub")}</p>
          </div>
          <select
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
            title={t("date")}
          >
            {yillar.map((yy) => (
              <option key={yy} value={yy}>
                {yy}
              </option>
            ))}
          </select>
          <select
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
            className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm capitalize"
            title={t("calendar")}
          >
            {monthNames.map((a, i) => (
              <option key={a} value={i + 1}>
                {a}
              </option>
            ))}
          </select>
          <button onClick={gitBugun} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">
            {t("cal_today")}
          </button>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
            {t("cal_close")}
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Hızlı yıl şeridi */}
          <div className="mb-3 flex flex-wrap gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <button
                key={i}
                onClick={() => setM(i + 1)}
                className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                  m === i + 1 ? "bg-slate-900 text-white" : "bg-amber-100 text-slate-700 hover:bg-amber-200"
                }`}
              >
                {monthNames[i].slice(0, 3)}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              {monthPrefix(y, m)} • {gunluk.size}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {HAFTA.map((h) => (
              <span key={h} className="py-1">
                {h}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {hucreler.map((iso, i) => {
              if (!iso) return <span key={`b-${i}`} />;
              const v = gunluk.get(iso);
              const bugunMu = iso === toISODate();
              const seciliMi = iso === secili;
              const net = v ? v.gelir - v.gider : 0;
              return (
                <button
                  key={iso}
                  onClick={() => setSecili(iso)}
                  onDoubleClick={() => onPickDate(iso)}
                  title={v ? `${fd(iso)}: ${v.adet} entries, net ${fm(net)}` : fd(iso)}
                  className={`min-h-[56px] rounded-xl border px-1 py-1 text-left transition ${
                    seciliMi
                      ? "border-slate-900 bg-slate-900 text-white"
                      : bugunMu
                        ? "border-teal-600 bg-teal-50"
                        : "border-amber-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <span className={`text-xs font-semibold ${seciliMi ? "text-white" : "text-slate-800"}`}>
                    {Number(iso.slice(8, 10))}
                  </span>
                  {v ? (
                    <span className="mt-0.5 block">
                      <span className={`block h-1.5 w-full rounded-full ${net >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <span className={`mt-0.5 block text-[10px] tabular-nums ${seciliMi ? "text-amber-200" : "text-slate-600"}`}>
                        {v.adet}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] text-slate-300">—</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Seçili gün özeti + aksiyonlar */}
          <div className="mt-4 rounded-2xl bg-white/70 p-3 ring-1 ring-amber-200">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm">
                <span className="font-semibold">{fd(secili)}</span>
                {gunluk.get(secili) ? (
                  <span className="text-slate-600">
                    {" "}
                    • {gunluk.get(secili)!.adet} • net {fm(gunluk.get(secili)!.gelir - gunluk.get(secili)!.gider)}
                  </span>
                ) : (
                  <span className="text-slate-500"> • {t("cal_noRecord")}</span>
                )}
              </p>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button
                  onClick={() => onPickDate(secili)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white"
                >
                  <I name="edit" size={14} /> {t("cal_writeDay")}
                </button>
                <button
                  onClick={() => {
                    setAralikBas(secili);
                    setAralikBit(secili);
                  }}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300"
                >
                  {t("cal_makeStart")}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
              <label className="text-xs text-slate-600">
                {t("cal_start")}
                <input
                  type="date"
                  value={aralikBas}
                  min="2015-01-01"
                  max="2035-12-31"
                  onChange={(e) => setAralikBas(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                {t("cal_end")}
                <input
                  type="date"
                  value={aralikBit}
                  min="2015-01-01"
                  max="2035-12-31"
                  onChange={(e) => setAralikBit(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <button
                onClick={() => {
                  if (aralikBas && aralikBit) onPickRange(aralikBas, aralikBit);
                }}
                className="inline-flex items-center gap-1.5 self-end rounded-lg bg-indigo-700 px-3 py-1.5 text-sm text-white"
              >
                <I name="report" size={14} /> {t("cal_getZ")}
              </button>
              <button
                onClick={() => {
                  if (aralikBas) onPickDate(aralikBas);
                }}
                className="self-end rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white"
              >
                {t("cal_goDate")}
              </button>
              {silAdet == null ? (
                <button
                  onClick={() => void topluSil(false)}
                  disabled={silYapiliyor || !aralikBas || !aralikBit}
                  className="inline-flex items-center gap-1.5 self-end rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-700 disabled:opacity-50"
                >
                  <I name="delete" size={14} /> {t("topsil_btn")}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 self-end rounded-lg bg-rose-50 p-1.5 ring-1 ring-rose-300 md:col-span-2">
                  <span className="text-xs font-semibold text-rose-800">
                    {silAdet === 0 ? t("topsil_yok") : `${silAdet} ${t("topsil_bulundu")}`}
                  </span>
                  <button
                    onClick={() => void topluSil(true)}
                    disabled={silYapiliyor || silAdet === 0}
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {silYapiliyor ? "…" : t("topsil_onay")}
                  </button>
                  <button onClick={() => setSilAdet(null)} className="rounded-lg px-2 py-1.5 text-xs text-slate-600">
                    {t("rep_giveUp")}
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {t("cal_tip")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
