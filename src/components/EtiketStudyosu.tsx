"use client";

import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import type { Musteri, Ziyaret } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { waMesajKur, ziyaretKodu } from "@/lib/wa-mesaj";
import {
  etiketCanvasCiz,
  kayitliPortlar,
  portAc,
  portBilgi,
  portIste,
  portKapat,
  seriDestekliMi,
  tsplGonder,
  tsplKur,
  type EtiketAlan,
  type SeriPort,
} from "@/lib/etiket-baski";
import { GlobalBar } from "./GlobalBar";
import { I } from "./ui-icon";

const SABLONLAR: Array<{ w: number; h: number }> = [
  { w: 60, h: 40 },
  { w: 30, h: 30 },
  { w: 40, h: 30 },
  { w: 80, h: 50 },
  { w: 50, h: 25 },
  { w: 35, h: 22 },
  { w: 90, h: 25 },
  { w: 102, h: 152 },
];

/** Etiket Stüdyosu: boyut şablonu + önizleme + D520 baskı (global, logosuz). */
export function EtiketStudyosu() {
  const { t, intl } = useT();
  const [sablon, setSablon] = useState(0);
  const [ozelW, setOzelW] = useState("60");
  const [ozelH, setOzelH] = useState("40");
  const [bosluk, setBosluk] = useState("3");
  const [boyut, setBoyut] = useState({ w: 60, h: 40 });
  const [kopya, setKopya] = useState("1");
  const [yogunluk, setYogunluk] = useState("2");
  const [baud, setBaud] = useState("115200");
  const [port, setPort] = useState<SeriPort | null>(null);
  const [durum, setDurum] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [seriVar, setSeriVar] = useState(false);
  const [onizleme, setOnizleme] = useState("");
  const [bilgi, setBilgi] = useState<{ musteri: Musteri; ziyaret: Ziyaret; siraNo: number; dukkan: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setSeriVar(seriDestekliMi());
    const q = new URLSearchParams(window.location.search);
    const m = q.get("m");
    const z = q.get("z");
    const n = Number(q.get("n") || 1) || 1;
    if (!m || !z) return;
    (async () => {
      try {
        const [dm, da] = await Promise.all([
          fetch(`/api/musteriler/${m}`).then((r) => r.json()),
          fetch("/api/ayarlar").then((r) => r.json()),
        ]);
        if (!dm.musteri) return;
        const zs: Ziyaret[] = (dm.musteri.ziyaretler ?? []).slice().sort((x: Ziyaret, y: Ziyaret) => x.tarih.localeCompare(y.tarih));
        const zj = zs.find((x) => x.id === z) ?? zs[zs.length - 1];
        if (!zj) return;
        const sira = zs.findIndex((x) => x.id === zj.id) + 1 || n;
        setBilgi({ musteri: dm.musteri, ziyaret: zj, siraNo: sira, dukkan: da.ayarlar?.isletmeAdi ?? "" });
      } catch {
        /* yoksay */
      }
    })();
  }, []);

  const alan: EtiketAlan | null = bilgi
    ? {
        adSoyad: `${bilgi.musteri.ad} ${bilgi.musteri.soyad}`.trim().toUpperCase() || "—",
        telefon: bilgi.musteri.telefon,
        siparisNo: `#${bilgi.siraNo}`,
        kod: ziyaretKodu(bilgi.musteri.id, bilgi.siraNo),
        sira: String(bilgi.siraNo).padStart(4, "0"),
        tarih: bilgi.ziyaret.tarih.split("-").reverse().join("."),
        durum: bilgi.ziyaret.durum === "teslim" ? t("mus_delivered") : bilgi.ziyaret.durum === "hazir" ? t("mus_ready") : t("mus_processing"),
        durumRenk: "#4a9b6f",
        dukkan: bilgi.dukkan,
        dukkanAlt: t("etiket_service"),
        qrIcerik: [
          "SHOP",
          ziyaretKodu(bilgi.musteri.id, bilgi.siraNo),
          `ORDER:${bilgi.siraNo}`,
          `CUST:${bilgi.musteri.id.replace(/-/g, "").slice(0, 8)}`,
          `VID:${bilgi.ziyaret.id.replace(/-/g, "").slice(0, 8)}`,
          `NAME:${`${bilgi.musteri.ad} ${bilgi.musteri.soyad}`.trim().replace(/\|/g, "/")}`,
          `PHONE:${bilgi.musteri.telefon.replace(/\D/g, "")}`,
          `SERVICE:${bilgi.ziyaret.hizmet.replace(/\|/g, "/")}`,
          `TS:${Date.now()}`,
        ].join("|"),
      }
    : null;

  function waMesajKurDurum(): string {
    return "?";
  }

  useEffect(() => {
    if (!bilgi || !alan) {
      setOnizleme("");
      return;
    }
    let canli = true;
    (async () => {
      try {
        const taban = await etiketCanvasCiz(alan);
        const W = Math.round((boyut.w * 203) / 25.4);
        const H = Math.round((boyut.h * 203) / 25.4);
        const c = document.createElement("canvas");
        c.width = Math.max(8, W);
        c.height = Math.max(8, H);
        const x = c.getContext("2d");
        if (!x) return;
        x.fillStyle = "#000";
        x.fillRect(0, 0, c.width, c.height);
        const o = Math.min(c.width / taban.width, c.height / taban.height);
        const dw = taban.width * o;
        const dh = taban.height * o;
        x.drawImage(taban, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
        canvasRef.current = c;
        if (canli) setOnizleme(c.toDataURL("image/png"));
      } catch {
        /* yoksay */
      }
    })();
    return () => {
      canli = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilgi, boyut]);

  async function baglan() {
    if (port) {
      await portKapat(port);
      setPort(null);
      setDurum("");
      return;
    }
    const kayitli = await kayitliPortlar();
    const p = kayitli.length === 1 ? kayitli[0] : await portIste();
    if (!p) return;
    const ok = await portAc(p, Number(baud) || 115200);
    if (!ok) {
      setDurum(t("bt_failed"));
      return;
    }
    const b = await portBilgi(p);
    setPort(p);
    setDurum(`${t("bt_connected")} (${b.usb ? "USB" : "COM"})`);
  }

  function hazirCanvas(): HTMLCanvasElement | null {
    return canvasRef.current;
  }

  async function simdiYazdir() {
    const c = hazirCanvas();
    if (!c) return;
    if (!port) {
      setDurum(t("bt_need"));
      return;
    }
    setMesgul(true);
    try {
      const ok = await tsplGonder(
        port,
        tsplKur(c, Math.max(1, Number(kopya) || 1), Number(yogunluk) || 2, Number(bosluk) || 3, boyut.w, boyut.h),
      );
      if (ok) setDurum(t("bt_done"));
      else {
        setDurum(t("bt_failed"));
        await portKapat(port);
        setPort(null);
      }
    } finally {
      setMesgul(false);
    }
  }

  function pngIndir() {
    const c = hazirCanvas();
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `etiket_${boyut.w}x${boyut.h}mm.png`;
    a.click();
  }

  function pdfIndir() {
    const c = hazirCanvas();
    if (!c) return;
    const yatay = boyut.w >= boyut.h;
    const pdf = new jsPDF({ unit: "mm", format: [boyut.w, boyut.h], orientation: yatay ? "l" : "p", compress: true });
    pdf.addImage(c.toDataURL("image/png"), "PNG", 0, 0, boyut.w, boyut.h);
    pdf.save(`etiket_${boyut.w}x${boyut.h}mm.pdf`);
  }

  function sablonSec(i: number) {
    setSablon(i);
    setBoyut({ w: SABLONLAR[i].w, h: SABLONLAR[i].h });
  }

  function ozelUygula() {
    const w = Math.max(10, Math.min(200, Number(ozelW) || 60));
    const h = Math.max(10, Math.min(200, Number(ozelH) || 40));
    setSablon(-1);
    setBoyut({ w, h });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-auto">
            <GlobalBar compact />
          </div>
        </div>

        <header className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 ring-1 ring-white/10">
          <a href="/app/musteriler" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg hover:bg-white/20" title={t("mus_back")}>
            ‹
          </a>
          <img src="/images/logo.svg" alt="Shop Ledger" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-amber-200/40" />
          <p className="mr-auto text-sm font-bold">
            Shop Ledger <span className="font-normal text-slate-400">· {t("et_studio")}</span>
          </p>
          <button type="button" onClick={pngIndir} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
            ↓ {t("et_png")}
          </button>
          <button type="button" onClick={pdfIndir} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
            ↓ {t("et_pdf")}
          </button>
          {seriVar ? (
            <button type="button" onClick={() => void baglan()} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
              {port ? t("bt_disconnect") : `◉ ${t("et_baglan")}`}
            </button>
          ) : null}
          <button type="button" disabled={mesgul} onClick={() => void simdiYazdir()} className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            🖨 {t("et_simdi")}
          </button>
        </header>

        <div className="grid flex-1 items-start gap-3 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
          <aside className="rounded-2xl bg-slate-900 p-3 ring-1 ring-white/10">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("et_sablonlar")} · {t("et_boyut")} (mm)</p>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {SABLONLAR.map((s, i) => (
                <button
                  key={`${s.w}x${s.h}`}
                  type="button"
                  onClick={() => sablonSec(i)}
                  className={`rounded-xl border px-3 py-2 text-left ${sablon === i ? "border-sky-500 bg-sky-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                >
                  <span className="block text-sm font-bold tabular-nums">{s.w}×{s.h}</span>
                  <span className="text-[11px] text-slate-400">mm</span>
                </button>
              ))}
            </div>
            <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("et_ozel")}</p>
            <div className="flex items-center gap-1.5">
              <input value={ozelW} onChange={(e) => setOzelW(e.target.value)} inputMode="decimal" className="w-full min-w-0 rounded-lg bg-white/10 px-2 py-1.5 text-sm outline-none" />
              <span className="text-slate-500">×</span>
              <input value={ozelH} onChange={(e) => setOzelH(e.target.value)} inputMode="decimal" className="w-full min-w-0 rounded-lg bg-white/10 px-2 py-1.5 text-sm outline-none" />
              <button type="button" onClick={ozelUygula} className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white">
                {t("et_uygula")}
              </button>
            </div>
          </aside>

          <main className="scroll-thin min-w-0 overflow-auto rounded-2xl bg-slate-900 p-4 ring-1 ring-white/10">
            {!bilgi ? (
              <p className="py-16 text-center text-sm text-slate-400">
                <a href="/app/musteriler" className="text-sky-400 underline">‹ {t("mus_title")}</a>
              </p>
            ) : onizleme ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <img src={onizleme} alt={t("et_studio")} className="h-auto max-w-full rounded shadow-2xl" style={{ maxHeight: "62vh" }} />
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">…</p>
            )}
            {bilgi ? (
              <p className="mt-2 text-center text-xs text-slate-400">
                {bilgi.musteri.ad} {bilgi.musteri.soyad} · {bilgi.ziyaret.hizmet} · {formatDate(bilgi.ziyaret.tarih, intl)} · {boyut.w}×{boyut.h}mm
              </p>
            ) : null}
          </main>

          <aside className="rounded-2xl bg-slate-900 p-3 ring-1 ring-white/10">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">⚙ {t("et_yazdirma")}</p>
            <div className={`mb-2 rounded-xl px-3 py-2 text-xs font-semibold ${port ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
              {port ? durum || t("bt_connected") : t("et_bagliDegil")}
            </div>
            {!seriVar ? <p className="mb-2 text-xs leading-relaxed text-slate-400">{t("bt_noserial")}</p> : null}
            {durum && port ? <p className="mb-2 text-xs text-emerald-300">{durum}</p> : null}
            {durum && !port ? <p className="mb-2 text-xs text-amber-300">{durum}</p> : null}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="text-slate-400">
                {t("bt_baud")}
                <select value={baud} onChange={(e) => setBaud(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-white outline-none [&>option]:text-slate-900">
                  <option value="115200">115200 (USB)</option>
                  <option value="9600">9600 (Bluetooth)</option>
                </select>
              </label>
              <label className="text-slate-400">
                {t("et_kopya")}
                <input value={kopya} onChange={(e) => setKopya(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-white outline-none" />
              </label>
              <label className="text-slate-400">
                {t("et_yogunluk")}
                <select value={yogunluk} onChange={(e) => setYogunluk(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-white outline-none [&>option]:text-slate-900">
                  <option value="1">{t("et_hafif")}</option>
                  <option value="2">{t("et_normal")}</option>
                  <option value="3">{t("et_koyu")}</option>
                </select>
              </label>
              <label className="text-slate-400">
                GAP (mm)
                <input value={bosluk} onChange={(e) => setBosluk(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-white outline-none" />
              </label>
            </div>
            <button type="button" disabled={mesgul} onClick={() => void simdiYazdir()} className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              🖨 {t("et_simdi")}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={pngIndir} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
                ↓ {t("et_png")}
              </button>
              <button type="button" onClick={pdfIndir} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
                ↓ {t("et_pdf")}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
