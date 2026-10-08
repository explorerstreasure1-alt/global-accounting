"use client";

import { useMemo, useState } from "react";
import type { Kayit } from "@/lib/types";
import { AYLAR, formatMoney, formatTRDate, monthPrefix, toISODate } from "@/lib/format";

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
};

const HAFTA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function TakvimPanel({ open, kayitlar, year, month, onClose, onPickDate, onPickRange }: Props) {
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
            <p className="font-hand text-3xl leading-none">📅 Takvim</p>
            <p className="text-xs text-slate-600">Tüm tarihler • Geçmişe kayıt yazmak için güne dokunun</p>
          </div>
          <select
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
            title="Yıl seç"
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
            title="Ay seç"
          >
            {AYLAR.map((a, i) => (
              <option key={a} value={i + 1}>
                {a}
              </option>
            ))}
          </select>
          <button onClick={gitBugun} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">
            Bugün
          </button>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
            Kapat
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
                {AYLAR[i].slice(0, 3)}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              {monthPrefix(y, m)} • {gunluk.size} günde kayıt var
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
                  title={v ? `${formatTRDate(iso)}: ${v.adet} kayıt, net ${formatMoney(net)} (çift tık: bu güne yaz)` : formatTRDate(iso)}
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
                        {v.adet} kayıt
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
                <span className="font-semibold">{formatTRDate(secili)}</span>
                {gunluk.get(secili) ? (
                  <span className="text-slate-600">
                    {" "}
                    • {gunluk.get(secili)!.adet} kayıt • net {formatMoney(gunluk.get(secili)!.gelir - gunluk.get(secili)!.gider)}
                  </span>
                ) : (
                  <span className="text-slate-500"> • bu günde kayıt yok</span>
                )}
              </p>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button
                  onClick={() => onPickDate(secili)}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white"
                >
                  ✍️ Bu güne yaz
                </button>
                <button
                  onClick={() => {
                    setAralikBas(secili);
                    setAralikBit(secili);
                  }}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300"
                >
                  Aralık başı yap
                </button>
              </div>
            </div>
            {/* Manuel tarih girişi (geçmişten yazacaklar için) */}
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
              <label className="text-xs text-slate-600">
                Başlangıç
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
                Bitiş
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
                className="self-end rounded-lg bg-indigo-700 px-3 py-1.5 text-sm text-white"
              >
                🧾 Z raporu al
              </button>
              <button
                onClick={() => {
                  if (aralikBas) onPickDate(aralikBas);
                }}
                className="self-end rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white"
              >
                Tarihe git
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              İpucu: Asistana “12.03.2023 tarihinde 2.000 TL kart hizmet geliri yaz” derseniz geçmişe de işler. Tarih formatı GG.AA.YYYY.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
