"use client";

import { useEffect, useState } from "react";
import type { Ayarlar, RaporOzet } from "@/lib/types";
import { formatMoneyLocale, formatDate, formatDateLong } from "@/lib/format";
import { gonderRapor, raporCanvas, raporJpgIndir, type GonderFormati } from "@/lib/rapor-gorsel";
import { I } from "./ui-icon";
import { useT, catLabel } from "@/lib/i18n";

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  rapor: RaporOzet | null;
  ayarlar: Ayarlar;
  baslangic: string;
  bitis: string;
  onBaslangic: (v: string) => void;
  onBitis: (v: string) => void;
  onClose: () => void;
  onRefresh: () => void;
  onExcel: () => void;
  singleDate?: boolean;
  damga?: string;
  pdfTip?: string;
};

export function ReportModal({
  open,
  title,
  subtitle,
  rapor,
  ayarlar,
  baslangic,
  bitis,
  onBaslangic,
  onBitis,
  onClose,
  onRefresh,
  onExcel,
  singleDate,
  damga,
  pdfTip,
}: Props) {
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const [gonderSec, setGonderSec] = useState(false);
  const [gonderDurum, setGonderDurum] = useState<string | null>(null);
  const { t, intl, currency, locale } = useT();
  const fm = (v: number, sym = true) => formatMoneyLocale(v, intl, currency, sym);
  const fd = (iso: string) => formatDate(iso, intl);
  if (!open) return null;

  const damgaMetni = damga ?? (singleDate ? "GÜN SONU" : "Z RAPORU");

  function gorselHazirla(): HTMLCanvasElement | null {
    if (!rapor) return null;
    try {
      return raporCanvas(rapor, ayarlar, title, damgaMetni, { locale, currency });
    } catch {
      return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-3 print:static print:bg-white print:p-0">
      <div className="print-root my-4 w-full max-w-4xl rounded-2xl bg-[#fbf6ea] text-slate-900 shadow-2xl print:my-0 print:max-w-none print:rounded-none print:shadow-none">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-amber-200 px-5 py-3">
          <div className="mr-auto">
            <p className="font-hand text-3xl leading-none">{title}</p>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>
          {singleDate ? (
            <input
              type="date"
              value={baslangic}
              onChange={(e) => {
                onBaslangic(e.target.value);
                onBitis(e.target.value);
              }}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
            />
          ) : (
            <>
              <input
                type="date"
                value={baslangic}
                onChange={(e) => onBaslangic(e.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
              />
              <span className="text-sm">—</span>
              <input
                type="date"
                value={bitis}
                onChange={(e) => onBitis(e.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
              />
            </>
          )}
          <button onClick={onRefresh} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">
            {t("rep_fetch")}
          </button>
          <button onClick={onExcel} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white">
            {t("rep_excel")}
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              const c = gorselHazirla();
              if (c && rapor) raporJpgIndir(c, title, rapor);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            <I name="backup" size={14} /> {t("rep_jpg")}
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              window.location.href = `/api/pdf?tip=${encodeURIComponent(pdfTip ?? "z")}&baslangic=${baslangic}&bitis=${bitis}&locale=${locale}&currency=${currency}`;
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            <I name="report" size={14} /> {t("rep_pdf")}
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              window.location.href = `/api/word?tip=${encodeURIComponent(pdfTip ?? "z")}&baslangic=${baslangic}&bitis=${bitis}&locale=${locale}&currency=${currency}`;
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            <I name="report" size={14} /> Word
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              setGonderDurum(null);
              setGonderSec(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            <I name="send" size={14} /> {t("rep_send")}
          </button>
          <button onClick={() => window.print()} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm text-white">
            {t("rep_printBtn")}
          </button>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
            {t("rep_close")}
          </button>
        </div>

        {gonderSec ? (
          <div className="no-print border-b border-amber-200 bg-sky-50 px-5 py-3">
            <p className="text-sm font-semibold text-slate-800">
              {t("rep_sendAs")} <span className="font-normal text-slate-500">({ayarlar.whatsappAlici || t("noDate")})</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["pdf", "jpg", "excel"] as GonderFormati[]).map((f) => (
                <button
                  key={f}
                  disabled={hazirlaniyor}
                  onClick={async () => {
                    if (!rapor) return;
                    setHazirlaniyor(true);
                    setGonderDurum(t("rep_loading"));
                    try {
                      const sonuc = await gonderRapor({
                        format: f,
                        canvas: f === "jpg" ? gorselHazirla() : null,
                        rapor,
                        isletmeAdi: ayarlar.isletmeAdi,
                        baslik: title,
                        tip: pdfTip ?? "z",
                        baslangic,
                        bitis,
                        alici: ayarlar.whatsappAlici,
                      });
                      setGonderDurum(
                        sonuc === "whatsapp-acildi"
                          ? t("toast_backupDownloading")
                          : sonuc === "indirildi"
                            ? t("toast_backupDownloading")
                            : t("toast_backupFailed"),
                      );
                    } finally {
                      setHazirlaniyor(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <I name={f === "excel" ? "excel" : "report"} size={14} /> {f === "pdf" ? "PDF" : f === "jpg" ? "JPG" : "Excel"}
                </button>
              ))}
              <button
                onClick={() => setGonderSec(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600"
              >
                {t("rep_giveUp")}
              </button>
            </div>
            {gonderDurum ? <p className="mt-1 text-xs text-slate-600">{gonderDurum}</p> : null}
          </div>
        ) : null}

        <div className="print-sheet px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/images/logo.svg" alt="Logo" className="h-16 w-16 rounded-full object-cover" />
              <div>
                <p className="font-hand text-4xl leading-none">{ayarlar.isletmeAdi}</p>
                <p className="mt-1 text-sm uppercase tracking-[0.2em] text-slate-500">{title}</p>
                <p className="text-sm text-slate-600">
                  {rapor ? `${fd(rapor.baslangic)} — ${fd(rapor.bitis)}` : ""}
                </p>
              </div>
            </div>
            <div className="stamp px-3 py-1 text-xs font-bold">{damga ?? (singleDate ? "GÜN SONU" : "Z RAPORU")}</div>
          </div>

          {rapor ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label={t("rep_cashIncome")} value={fm(rapor.nakitGelir)} />
                <Stat label={t("rep_cashExpense")} value={fm(rapor.nakitGider)} />
                <Stat label={t("rep_cardIncome")} value={fm(rapor.kartGelir)} />
                <Stat label={t("rep_cardExpense")} value={fm(rapor.kartGider)} />
                <Stat label={t("rep_transferIncome")} value={fm(rapor.havaleGelir)} />
                <Stat label={t("rep_transferExpense")} value={fm(rapor.havaleGider)} />
                <Stat label={t("rep_cashNet")} value={fm(rapor.nakitNet)} accent />
                <Stat label={t("rep_cardNet")} value={fm(rapor.kartNet)} accent />
                <Stat label={t("rep_transferNet")} value={fm(rapor.havaleNet)} accent />
                <Stat label={t("rep_totalIncome")} value={fm(rapor.gelir)} />
                <Stat label={t("rep_totalExpense")} value={fm(rapor.gider)} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label={t("rep_grandNet")} value={fm(rapor.net)} big />
                <Stat label={t("rep_opening")} value={fm(rapor.acilisBakiyesi)} />
                <Stat label={t("rep_closing")} value={fm(rapor.kapanisBakiyesi)} big />
              </div>

              <GrafikCubuklari rapor={rapor} />

              <h3 className="mt-8 font-hand text-2xl">{t("rep_dailyBreak")}</h3>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2">{t("nb_thDate")}</th>
                    <th>{t("pay_cash")}</th>
                    <th>{t("pay_card")}</th>
                    <th>{t("pay_transfer")}</th>
                    <th>{t("nb_thIncome")}</th>
                    <th>{t("nb_thExpense")}</th>
                    <th>{t("net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.gunler.map((g) => (
                    <tr key={g.tarih} className="border-b border-slate-200">
                      <td className="py-1.5">{fd(g.tarih)}</td>
                      <td>{fm(g.nakitGelir - g.nakitGider)}</td>
                      <td>{fm(g.kartGelir - g.kartGider)}</td>
                      <td>{fm(g.havaleGelir - g.havaleGider)}</td>
                      <td>{fm(g.gelir)}</td>
                      <td>{fm(g.gider)}</td>
                      <td className="font-semibold">{fm(g.net)}</td>
                    </tr>
                  ))}
                  {rapor.gunler.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-500">
                        {t("rep_noRange")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <h3 className="mt-8 font-hand text-2xl">{t("rep_categories")}</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {rapor.kategoriler.map((k) => (
                  <div key={k.kategori} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm">
                    <span>{catLabel(k.kategori, locale)} · {k.adet}</span>
                    <span className="tabular-nums">{fm(k.net)}</span>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 font-hand text-2xl">{t("rep_receipts")}</h3>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2">{t("nb_thDate")}</th>
                    <th>{t("nb_thDesc")}</th>
                    <th>{t("nb_thCat")}</th>
                    <th>{t("nb_thPay")}</th>
                    <th>{t("nb_thIncome")}</th>
                    <th>{t("nb_thExpense")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.kayitlar.map((k) => (
                    <tr key={k.id} className="border-b border-slate-200">
                      <td className="py-1.5">{fd(k.tarih)}</td>
                      <td>{k.aciklama}</td>
                      <td>{catLabel(k.kategori, locale)}</td>
                      <td>{k.odemeTipi === "Nakit" ? t("pay_cash") : k.odemeTipi === "Havale" ? t("pay_transfer") : t("pay_card")}</td>
                      <td>{k.gelir ? fm(k.gelir) : "—"}</td>
                      <td>{k.gider ? fm(k.gider) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-8 text-right text-xs text-slate-500">
                {ayarlar.isletmeAdi} · {formatDateLong(rapor.bitis, intl)}
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-slate-500">{t("rep_loading")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GrafikCubuklari({ rapor }: { rapor: RaporOzet }) {
  const { t, intl, currency, locale } = useT();
  const fm = (v: number, sym = true) => formatMoneyLocale(v, intl, currency, sym);
  const fd = (iso: string) => formatDate(iso, intl);
  const maxGun = Math.max(1, ...rapor.gunler.map((g) => Math.abs(g.net)));
  const maxKat = Math.max(1, ...rapor.kategoriler.map((k) => k.gider + k.gelir));
  const gunler = rapor.gunler.slice(-14);
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{t("rep_dailyChart")}{rapor.gunler.length > 14 ? " (14)" : ""}</p>
        <div className="mt-2 space-y-1">
          {gunler.map((g) => (
            <div key={g.tarih} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 shrink-0 tabular-nums text-slate-600">{fd(g.tarih).slice(0, 5)}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="yazdir-renk h-3 rounded-full"
                  style={{
                    width: `${Math.max(3, Math.round((Math.abs(g.net) / maxGun) * 100))}%`,
                    background: g.net >= 0 ? "#15803d" : "#b91c1c",
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-slate-700">{fm(g.net, false)}</span>
            </div>
          ))}
          {gunler.length === 0 ? <p className="text-xs text-slate-400">{t("rep_noRange")}</p> : null}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{t("rep_catDist")}</p>
        <div className="mt-2 space-y-1">
          {rapor.kategoriler.slice(0, 8).map((k) => (
            <div key={k.kategori} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 shrink-0 truncate text-slate-600">{catLabel(k.kategori, locale)}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="yazdir-renk h-3 rounded-full"
                  style={{
                    width: `${Math.max(3, Math.round(((k.gider + k.gelir) / maxKat) * 100))}%`,
                    background: "#16324f",
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-slate-700">{fm(k.net, false)}</span>
            </div>
          ))}
          {rapor.kategoriler.length === 0 ? <p className="text-xs text-slate-400">{t("rep_noRange")}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: boolean;
  big?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-amber-200 bg-white/80 px-3 py-3 ${big ? "col-span-1" : ""}`}>
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${accent ? "text-teal-800" : "text-slate-900"} ${big ? "text-xl" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}

type SettingsProps = {
  open: boolean;
  ayarlar: Ayarlar;
  onClose: () => void;
  onSave: (patch: Partial<Ayarlar>) => Promise<void>;
  onYedekIndir: () => void;
  onYedekYukle: () => void;
  onSifirla: () => void;
  onKiraBol: (ay: number) => Promise<boolean>;
};

function KiraBolBolumu({ varsayilanAy, onKiraBol }: { varsayilanAy: number; onKiraBol: (ay: number) => Promise<boolean> }) {
  const { t } = useT();
  const [ay, setAy] = useState(varsayilanAy > 0 ? varsayilanAy : 6);
  const [kurulu, setKurulu] = useState(false);
  const [yapiliyor, setYapiliyor] = useState(false);
  if (!kurulu) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white/60 p-3 ring-1 ring-amber-200">
        <label className="text-xs text-slate-600">
          {t("kirabol_ay")}
          <input
            type="number"
            min={1}
            max={36}
            value={ay}
            onChange={(e) => setAy(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
            className="mt-1 w-20 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setKurulu(true)}
          className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm text-white"
        >
          {t("kirabol_btn")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-300">
      <span className="text-sm">{t("kirabol_emin")} ({ay})</span>
      <button
        type="button"
        disabled={yapiliyor}
        onClick={async () => {
          setYapiliyor(true);
          try {
            if (await onKiraBol(ay)) setKurulu(false);
          } finally {
            setYapiliyor(false);
          }
        }}
        className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {yapiliyor ? "…" : t("kirabol_onay")}
      </button>
      <button type="button" onClick={() => setKurulu(false)} className="rounded-lg px-3 py-1.5 text-sm">
        {t("rep_giveUp")}
      </button>
    </div>
  );
}

type HafizaBilgi = {
  mod: string;
  kayitSayisi: number;
  mesajSayisi: number;
  yedekSayisi: number;
  sonYedek: string | null;
  veriKlasoru: string;
  groqAktif: boolean;
};

function HafizaBolumu({
  onYedekIndir,
  onYedekYukle,
  onSifirla,
}: {
  onYedekIndir: () => void;
  onYedekYukle: () => void;
  onSifirla: () => void;
}) {
  const [bilgi, setBilgi] = useState<HafizaBilgi | null>(null);
  const [sifirlaKurulu, setSifirlaKurulu] = useState(false);
  const { t } = useT();

  useEffect(() => {
    fetch("/api/hafiza")
      .then((r) => r.json())
      .then((j) => setBilgi(j as HafizaBilgi))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!sifirlaKurulu) return;
    const t = setTimeout(() => setSifirlaKurulu(false), 6000);
    return () => clearTimeout(t);
  }, [sifirlaKurulu]);

  return (
    <div className="mt-5 rounded-2xl bg-slate-900 p-4 text-slate-100">
      <p className="font-hand inline-flex items-center gap-2 text-2xl text-emerald-200"><I name="db" size={20} /> {t("mem_title")}</p>
      {bilgi ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t("mem_mode")}</p>
              <p className="font-semibold">{bilgi.mod === "postgres" ? t("mem_dbFile") : t("mem_file")}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t("mem_records")}</p>
              <p className="font-semibold tabular-nums">{bilgi.kayitSayisi}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t("mem_chat")}</p>
              <p className="font-semibold tabular-nums">{bilgi.mesajSayisi}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t("mem_backupCount")}</p>
              <p className="font-semibold tabular-nums">{bilgi.yedekSayisi}</p>
            </div>
          </div>
          <p className="mt-2 truncate text-[11px] text-slate-400" title={bilgi.veriKlasoru}>
            {bilgi.veriKlasoru}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onYedekIndir} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white">
              <I name="backup" size={14} /> {t("mem_download")}
            </button>
            <button type="button" onClick={onYedekYukle} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              <I name="reset" size={14} /> {t("mem_restore")}
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-rose-500/40 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-rose-200"><I name="warn" size={13} /> {t("mem_danger")}</p>
            {sifirlaKurulu ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSifirlaKurulu(false);
                    onSifirla();
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white"
                >
                  {t("mem_yesReset")}
                </button>
                <button type="button" onClick={() => setSifirlaKurulu(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                  {t("rep_giveUp")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSifirlaKurulu(true)}
                className="inline-flex items-center gap-1.5 mt-2 rounded-lg border border-rose-400/60 px-3 py-1.5 text-sm text-rose-200"
              >
                <I name="delete" size={14} /> {t("mem_resetAll")}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{t("mem_loading")}</p>
      )}
    </div>
  );
}

export function SettingsModal({ open, ayarlar, onClose, onSave, onYedekIndir, onYedekYukle, onSifirla, onKiraBol }: SettingsProps) {
  const { t, currency } = useT();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <form
        className="scroll-thin my-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#fbf6ea] p-6 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const kiraTutari = Number(data.get("kiraTutari") || 0);
          const kiraPeriyodu = Number(data.get("kiraPeriyodu") || 6);
          await onSave({
            isletmeAdi: String(data.get("isletmeAdi") || ""),
            kiraTutari,
            kiraPeriyodu,
            aylikKiraKarsiligi: kiraPeriyodu ? kiraTutari / kiraPeriyodu : 0,
            kiraSonrakiTarih: String(data.get("kiraSonrakiTarih") || "") || null,
            acilisBakiyesi: Number(data.get("acilisBakiyesi") || 0),
            whatsappAlici: String(data.get("whatsappAlici") || "").trim() || "",
          });
          onClose();
        }}
      >
        <p className="font-hand text-3xl">{t("set_title")}</p>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            {t("set_shop")}
            <input name="isletmeAdi" defaultValue={ayarlar.isletmeAdi} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              {t("set_rent")} ({currency})
              <input name="kiraTutari" type="number" step="0.01" defaultValue={ayarlar.kiraTutari} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
            </label>
            <label className="text-sm">
              {t("set_period")}
              <input name="kiraPeriyodu" type="number" defaultValue={ayarlar.kiraPeriyodu} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
            </label>
          </div>
          <p className="text-xs text-slate-600">
            {t("set_periodHint")}
          </p>
          <label className="text-sm">
            {t("set_nextRent")}
            <input name="kiraSonrakiTarih" type="date" defaultValue={ayarlar.kiraSonrakiTarih ?? ""} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            {t("set_opening")} ({currency})
            <input name="acilisBakiyesi" type="number" step="0.01" defaultValue={ayarlar.acilisBakiyesi} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <KiraBolBolumu varsayilanAy={ayarlar.kiraPeriyodu} onKiraBol={onKiraBol} />
          <label className="text-sm">
            {t("set_waNumber")}
            <input name="whatsappAlici" defaultValue={ayarlar.whatsappAlici} placeholder="" className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
        </div>
        <HafizaBolumu onYedekIndir={onYedekIndir} onYedekYukle={onYedekYukle} onSifirla={onSifirla} />
        <div className="sticky bottom-0 mt-5 flex justify-end gap-2 bg-[#fbf6ea] py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm">
            {t("set_giveUp")}
          </button>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
            {t("set_save")}
          </button>
        </div>
      </form>
    </div>
  );
}

type TelefonBilgi = {
  ip: string;
  port: number;
  url: string;
  qr: string | null;
};

/** Telefonda aç: aynı Wi-Fi'den karekodla bağlan. */
export function TelefonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const [bilgi, setBilgi] = useState<TelefonBilgi | null>(null);
  const [kopya, setKopya] = useState(false);
  const [kurabilir, setKurabilir] = useState(false);
  const [kuruldu, setKuruldu] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBilgi(null);
    fetch("/api/telefon")
      .then((r) => r.json())
      .then((j) => setBilgi(j as TelefonBilgi))
      .catch(() => undefined);
  }, [open ]);

  useEffect(() => {
    const yakala = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __kurOlay?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }).__kurOlay = e as unknown as {
        prompt: () => void;
        userChoice: Promise<{ outcome: string }>;
      };
      setKurabilir(true);
    };
    window.addEventListener("beforeinstallprompt", yakala);
    return () => window.removeEventListener("beforeinstallprompt", yakala);
  }, []);

  async function kur() {
    const olay = (window as unknown as { __kurOlay?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }).__kurOlay;
    if (!olay) {
      setKuruldu("Install from your phone browser menu (see instructions above).");
      return;
    }
    try {
      olay.prompt();
      const secim = await olay.userChoice;
      setKuruldu(secim.outcome === "accepted" ? "Installing — Shop Ledger will appear on your home screen." : "Cancelled — you can also install from the menu.");
      if (secim.outcome === "accepted") setKurabilir(false);
    } catch {
      setKuruldu("Failed — try from the menu.");
    }
  }

  useEffect(() => {
    if (!kopya) return;
    const t = setTimeout(() => setKopya(false), 2000);
    return () => clearTimeout(t);
  }, [kopya]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="scroll-thin my-auto max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-[#fbf6ea] p-6 text-center shadow-2xl">
        <p className="font-hand text-3xl">📱 {t("phone_title")}</p>
        <p className="mt-1 text-xs text-slate-600">{t("phone_sub")}</p>
        {bilgi ? (
          <>
            {bilgi.qr ? (
              <img src={bilgi.qr} alt="QR" className="mx-auto mt-3 h-52 w-52 rounded-xl bg-white p-2 ring-1 ring-amber-300" />
            ) : null}
            <p className="mt-3 font-mono text-lg font-bold text-slate-900">{bilgi.url}</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(bilgi.url).then(
                  () => setKopya(true),
                  () => undefined,
                );
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-sm text-white"
            >
              {kopya ? (<><I name="check" size={14} /> {t("phone_copied")}</>) : t("phone_copy")}
            </button>
          </>
        ) : null}
        <button type="button" onClick={onClose} className="mt-4 rounded-lg px-4 py-2 text-sm text-slate-600">
          {t("phone_close")}
        </button>
      </div>
    </div>
  );
}
