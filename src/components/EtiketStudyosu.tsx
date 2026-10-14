"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import type { Musteri, Ziyaret } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { maskAd, maskSoyad } from "@/lib/gizlilik";
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
  { w: 40, h: 60 },
  { w: 60, h: 40 },
  { w: 30, h: 30 },
  { w: 40, h: 30 },
  { w: 80, h: 50 },
  { w: 50, h: 25 },
  { w: 35, h: 22 },
  { w: 90, h: 25 },
  { w: 102, h: 152 },
];

/** Önizleme üstü dokunmatik alanlar (% konum). */
function zonlar(t: (k: string) => string): Array<{ id: string; l: number; t: number; w: number; h: number; baslik: string }> {
  return [
    { id: "dukkan", l: 2, t: 2, w: 56, h: 8, baslik: t("set_shop") },
    { id: "slogan", l: 2, t: 10, w: 56, h: 9, baslik: t("et_slogan") },
    { id: "adSoyad", l: 31, t: 21, w: 65, h: 15, baslik: t("mus_name") },
    { id: "telefon", l: 31, t: 40, w: 65, h: 12, baslik: t("mus_phone") },
    { id: "siparisNo", l: 31, t: 56, w: 32, h: 11, baslik: t("et_no") },
    { id: "kod", l: 64, t: 56, w: 32, h: 11, baslik: t("et_kod") },
    { id: "sira", l: 31, t: 69, w: 65, h: 13, baslik: t("et_sira") },
    { id: "tarih", l: 39, t: 82, w: 57, h: 11, baslik: t("et_tarih") },
    { id: "durum", l: 67, t: 2, w: 29, h: 10, baslik: t("et_durum") },
    { id: "qr", l: 2, t: 28, w: 27, h: 44, baslik: t("et_qr") },
  ];
}

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
  const [seriVar] = useState(() => seriDestekliMi());
  const [onizleme, setOnizleme] = useState("");
  const [bilgi, setBilgi] = useState<{ musteri: Musteri; ziyaret: Ziyaret; siraNo: number; dukkan: string } | null>(null);
  const [alan, setAlan] = useState<EtiketAlan | null>(null);
  const [durumKey, setDurumKey] = useState<"hazirlaniyor" | "hazir" | "teslim">("hazirlaniyor");
  const [qrOzel, setQrOzel] = useState("");
  const [vurgu, setVurgu] = useState<string | null>(null);
  const [duzenId, setDuzenId] = useState<string | null>(null);
  const [kayitBilgi, setKayitBilgi] = useState("");
  /** Etiket başlığı varsayılanı: kullanıcı Kaydet'e basar, bu cihazda kalır, her açılışta hazır gelir. */
  const [varsayilan] = useState<{ dukkan: string; dukkanAlt: string } | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const ham = window.localStorage.getItem("etiket-varsayilan-v1");
      if (!ham) return null;
      const j = JSON.parse(ham) as { dukkan?: string; dukkanAlt?: string };
      if (!j.dukkan && !j.dukkanAlt) return null;
      return { dukkan: j.dukkan ?? "", dukkanAlt: j.dukkanAlt ?? "" };
    } catch {
      return null;
    }
  });
  const alanRef = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
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

  // Ziyaret verisi gelince düzenlenebilir alanı kur
  useEffect(() => {
    if (!bilgi) {
      setAlan(null);
      return;
    }
    const dk = bilgi.ziyaret.durum;
    setDurumKey(dk);
    setQrOzel("");
    setAlan({
      // Etikette isim yıldızlı (TAN** G*****), numara tam görünür.
      adSoyad: `${maskAd(bilgi.musteri.ad)} ${maskSoyad(bilgi.musteri.soyad)}`.trim().toUpperCase() || "—",
      telefon: bilgi.musteri.telefon,
      siparisNo: `#${bilgi.siraNo}`,
      kod: ziyaretKodu(bilgi.musteri.id, bilgi.siraNo),
      sira: String(bilgi.siraNo).padStart(4, "0"),
      tarih: bilgi.ziyaret.tarih.split("-").reverse().join("."),
      durum: dk === "teslim" ? t("mus_delivered") : dk === "hazir" ? t("mus_ready") : t("mus_processing"),
      durumRenk: "#4a9b6f",
      // Kaydedilmiş başlık varsa o gelir (tekrar yazmaya gerek yok), yoksa Ayarlar'daki işletme adı.
      dukkan: varsayilan?.dukkan || bilgi.dukkan,
      dukkanAlt: varsayilan?.dukkanAlt || t("etiket_service"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilgi]);

  /** QR: özel yazıldıysa o, yoksa güncel alanlardan otomatik. */
  function qrEfektif(): string {
    if (qrOzel.trim()) return qrOzel.trim();
    if (!bilgi || !alan) return "-";
    return [
      "SHOP",
      alan.kod,
      `ORDER:${bilgi.siraNo}`,
      `CUST:${bilgi.musteri.id.replace(/-/g, "").slice(0, 8)}`,
      `VID:${bilgi.ziyaret.id.replace(/-/g, "").slice(0, 8)}`,
      `NAME:${alan.adSoyad.replace(/\|/g, "/")}`,
      `PHONE:${alan.telefon.replace(/\D/g, "")}`,
      `SERVICE:${bilgi.ziyaret.hizmet.replace(/\|/g, "/")}`,
      `TS:${Date.now()}`,
    ].join("|");
  }

  /** Etiket üstüne dokununca yerinde düzenleyici aç + soldaki kutuyu vurgula. */
  function odakla(id: string) {
    setVurgu(id);
    setDuzenId(id);
    setTimeout(() => setVurgu((v) => (v === id ? null : v)), 2500);
  }

  /** Önizleme üstündeki değer (input ilk açılışında seçili gelir, direkt sil-yaz). */
  function duzenDeger(id: string): string {
    if (!alan) return "";
    if (id === "qr") return qrOzel;
    if (id === "durum") return durumKey;
    if (id === "dukkan") return alan.dukkan;
    if (id === "slogan") return alan.dukkanAlt;
    if (id === "adSoyad") return alan.adSoyad;
    if (id === "telefon") return alan.telefon;
    if (id === "siparisNo") return alan.siparisNo;
    if (id === "kod") return alan.kod;
    if (id === "sira") return alan.sira;
    if (id === "tarih") return alan.tarih;
    return "";
  }

  /** Önizleme üstünden yazınca alanı + QR'ı anında güncelle (otomatik önizleme). */
  function duzenYaz(id: string, v: string) {
    if (id === "qr") {
      setQrOzel(v);
      return;
    }
    if (id === "durum") {
      durumSec(v);
      return;
    }
    if (!alan) return;
    if (id === "dukkan") alanYaz("dukkan", v);
    else if (id === "slogan") alanYaz("dukkanAlt", v);
    else if (id === "adSoyad") alanYaz("adSoyad", v);
    else if (id === "telefon") alanYaz("telefon", v);
    else if (id === "siparisNo") alanYaz("siparisNo", v);
    else if (id === "kod") alanYaz("kod", v);
    else if (id === "sira") alanYaz("sira", v);
    else if (id === "tarih") alanYaz("tarih", v);
  }

  function alanYaz<K extends keyof EtiketAlan>(k: K, v: EtiketAlan[K]) {
    setAlan((a) => (a ? { ...a, [k]: v } : a));
  }

  /** Başlığı bu cihaza kaydet: sonraki etiketler hazır gelir, tekrar yazmaya gerek yok. */
  function baslikKaydet() {
    if (!alan) return;
    try {
      window.localStorage.setItem("etiket-varsayilan-v1", JSON.stringify({ dukkan: alan.dukkan, dukkanAlt: alan.dukkanAlt }));
      setKayitBilgi(t("toast_settingsSaved"));
      setTimeout(() => setKayitBilgi(""), 2500);
    } catch {
      /* yoksay */
    }
  }

  const girisKls = "w-full min-w-0 rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white outline-none";

  function kutu(id: string, etiket: string, icerik: ReactNode) {
    return (
      <label className={`block rounded-lg px-2 py-1 ring-1 ${vurgu === id ? "bg-slate-200/20 ring-slate-300" : "ring-transparent"}`}>
        <span className="text-[11px] text-amber-100/60">{etiket}</span>
        {icerik}
      </label>
    );
  }

  function durumSec(v: string) {
    const key = (["hazirlaniyor", "hazir", "teslim"] as const).includes(v as "hazirlaniyor") ? (v as "hazirlaniyor" | "hazir" | "teslim") : "hazirlaniyor";
    setDurumKey(key);
    alanYaz("durum", key === "teslim" ? t("mus_delivered") : key === "hazir" ? t("mus_ready") : t("mus_processing"));
    alanYaz("durumRenk", key === "teslim" ? "#4ade80" : key === "hazir" ? "#7dd3fc" : "#4a9b6f");
  }

  useEffect(() => {
    if (!alan) {
      setOnizleme("");
      return;
    }
    let canli = true;
    const qr = qrEfektif();
    (async () => {
      try {
        const taban = await etiketCanvasCiz({ ...alan, qrIcerik: qr });
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
  }, [alan, boyut, qrOzel, bilgi]);

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
    <div className="desk-app min-h-screen text-amber-50">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-auto">
            <GlobalBar compact />
          </div>
        </div>

        <header className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-black/25 px-3 py-2 backdrop-blur-md">
          <a href="/app/musteriler" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg hover:bg-white/20" title={t("mus_back")}>
            ‹
          </a>
          <img src="/images/logo.svg" alt="Shop Ledger" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-200/40" />
          <p className="mr-auto text-sm font-bold">
            Shop Ledger <span className="font-normal text-amber-100/60">· {t("et_studio")}</span>
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
          <aside className="rounded-2xl bg-black/25 p-3 backdrop-blur-md">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-100/60">{t("et_sablonlar")} · {t("et_boyut")} (mm)</p>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {SABLONLAR.map((s, i) => (
                <button
                  key={`${s.w}x${s.h}`}
                  type="button"
                  onClick={() => sablonSec(i)}
                  className={`rounded-xl border px-3 py-2 text-left ${sablon === i ? "border-sky-500 bg-sky-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                >
                  <span className="block text-sm font-bold tabular-nums">{s.w}×{s.h}</span>
                  <span className="text-[11px] text-amber-100/60">mm</span>
                </button>
              ))}
            </div>
            <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-amber-100/60">{t("et_ozel")}</p>
            <div className="flex items-center gap-1.5">
              <input value={ozelW} onChange={(e) => setOzelW(e.target.value)} inputMode="decimal" className="w-full min-w-0 rounded-lg bg-white/10 px-2 py-1.5 text-sm outline-none" />
              <span className="text-amber-100/60">×</span>
              <input value={ozelH} onChange={(e) => setOzelH(e.target.value)} inputMode="decimal" className="w-full min-w-0 rounded-lg bg-white/10 px-2 py-1.5 text-sm outline-none" />
              <button type="button" onClick={ozelUygula} className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white">
                {t("et_uygula")}
              </button>
            </div>
            {alan ? (
              <>
                <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-amber-100/60">{t("et_icerik")}</p>
                <p className="mb-2 text-[11px] leading-snug text-amber-100/50">{t("et_ipucu")}</p>
                <div className="space-y-1.5">
                  {kutu("dukkan", t("set_shop"), (
                    <input value={alan.dukkan} onChange={(e) => alanYaz("dukkan", e.target.value)} ref={(el) => { alanRef.current["dukkan"] = el; }} className={girisKls} />
                  ))}
                  {kutu("slogan", t("et_slogan"), (
                    <input value={alan.dukkanAlt} onChange={(e) => alanYaz("dukkanAlt", e.target.value)} ref={(el) => { alanRef.current["slogan"] = el; }} className={girisKls} />
                  ))}
                  {kutu("adSoyad", t("mus_name"), (
                    <input value={alan.adSoyad} onChange={(e) => alanYaz("adSoyad", e.target.value)} ref={(el) => { alanRef.current["adSoyad"] = el; }} className={girisKls} />
                  ))}
                  {kutu("telefon", t("mus_phone"), (
                    <input value={alan.telefon} onChange={(e) => alanYaz("telefon", e.target.value)} inputMode="tel" ref={(el) => { alanRef.current["telefon"] = el; }} className={girisKls} />
                  ))}
                  {kutu("siparisNo", t("et_no"), (
                    <input value={alan.siparisNo} onChange={(e) => alanYaz("siparisNo", e.target.value)} ref={(el) => { alanRef.current["siparisNo"] = el; }} className={girisKls} />
                  ))}
                  {kutu("kod", t("et_kod"), (
                    <input value={alan.kod} onChange={(e) => alanYaz("kod", e.target.value)} ref={(el) => { alanRef.current["kod"] = el; }} className={girisKls} />
                  ))}
                  {kutu("sira", t("et_sira"), (
                    <input value={alan.sira} onChange={(e) => alanYaz("sira", e.target.value)} ref={(el) => { alanRef.current["sira"] = el; }} className={girisKls} />
                  ))}
                  {kutu("tarih", t("et_tarih"), (
                    <input value={alan.tarih} onChange={(e) => alanYaz("tarih", e.target.value)} ref={(el) => { alanRef.current["tarih"] = el; }} className={girisKls} />
                  ))}
                  {kutu("durum", t("et_durum"), (
                    <select
                      value={durumKey}
                      onChange={(e) => durumSec(e.target.value)}
                      ref={(el) => { alanRef.current["durum"] = el; }}
                      className={`${girisKls} [&>option]:text-slate-900`}
                    >
                      <option value="hazirlaniyor">{t("mus_processing")}</option>
                      <option value="hazir">{t("mus_ready")}</option>
                      <option value="teslim">{t("mus_delivered")}</option>
                    </select>
                  ))}
                  {kutu("qr", t("et_qr"), (
                    <textarea
                      value={qrOzel}
                      onChange={(e) => setQrOzel(e.target.value)}
                      rows={2}
                      ref={(el) => { alanRef.current["qr"] = el; }}
                      className={`${girisKls} resize-none font-mono text-xs`}
                    />
                  ))}
                  {!qrOzel.trim() ? <p className="truncate px-2 font-mono text-[10px] text-amber-100/40">{qrEfektif().slice(0, 48)}…</p> : null}
                  <button
                    type="button"
                    onClick={baslikKaydet}
                    className="w-full rounded-lg bg-slate-200/20 px-3 py-2 text-xs font-bold text-amber-100 ring-1 ring-slate-300/40 hover:bg-slate-200/30"
                  >
                    💾 {t("cm_kaydet")} · {t("set_shop")}
                  </button>
                  {kayitBilgi ? <p className="px-2 text-[11px] text-emerald-300">{kayitBilgi}</p> : null}
                </div>
              </>
            ) : null}
          </aside>

          <main className="scroll-thin min-w-0 overflow-auto rounded-2xl bg-[#fafafa] p-4 ring-1 ring-slate-300">
            {!bilgi ? (
              <p className="py-16 text-center text-sm text-amber-100/60">
                <a href="/app/musteriler" className="text-sky-300 underline">‹ {t("mus_title")}</a>
              </p>
            ) : onizleme ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="relative inline-block max-w-full rounded-lg bg-slate-950/40 p-3 ring-1 ring-slate-800/50">
                  <img src={onizleme} alt={t("et_studio")} className="h-auto max-w-full rounded shadow-2xl ring-2 ring-slate-800/60" style={{ maxHeight: "62vh" }} />
                  {zonlar(t).map((z) => {
                    if (duzenId === z.id) {
                      const genis = z.w < 35;
                      if (z.id === "durum") {
                        return (
                          <select
                            key={z.id}
                            autoFocus
                            value={durumKey}
                            onChange={(e) => duzenYaz(z.id, e.target.value)}
                            onBlur={() => setDuzenId(null)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLSelectElement).blur(); }}
                            aria-label={z.baslik}
                            className="absolute z-10 rounded border border-slate-300 bg-black/95 px-1 py-1 text-xs text-white outline-none"
                            style={{ left: `${z.l}%`, top: `${z.t}%`, width: `${Math.max(z.w, 30)}%`, minHeight: `${z.h}%` }}
                          >
                            <option value="hazirlaniyor">{t("mus_processing")}</option>
                            <option value="hazir">{t("mus_ready")}</option>
                            <option value="teslim">{t("mus_delivered")}</option>
                          </select>
                        );
                      }
                      if (z.id === "qr") {
                        return (
                          <span
                            key={z.id}
                            className="absolute z-10 rounded border border-slate-300 bg-black/95 p-1"
                            style={{ left: `${z.l}%`, top: `${z.t}%`, width: `${Math.max(z.w, 42)}%`, minHeight: `${z.h}%` }}
                          >
                            <textarea
                              autoFocus
                              value={qrOzel}
                              onChange={(e) => duzenYaz(z.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => setDuzenId(null)}
                              onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur(); }}
                              rows={3}
                              placeholder="QR — boş = otomatik"
                              aria-label={z.baslik}
                              className="w-full resize-none rounded bg-slate-900 px-1 py-1 font-mono text-[11px] text-white outline-none"
                            />
                            {!qrOzel.trim() ? <span className="block truncate font-mono text-[9px] text-slate-300">{qrEfektif().slice(0, 40)}…</span> : null}
                          </span>
                        );
                      }
                      return (
                        <input
                          key={z.id}
                          autoFocus
                          value={duzenDeger(z.id)}
                          onChange={(e) => duzenYaz(z.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => setDuzenId(null)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
                          aria-label={z.baslik}
                          placeholder={z.baslik}
                          className={`absolute z-10 rounded border border-slate-300 bg-black/95 px-1 py-1 text-white outline-none ${genis ? "text-[11px]" : "text-sm font-bold"}`}
                          style={{ left: `${z.l}%`, top: `${z.t}%`, width: `${z.w}%`, minHeight: `${z.h}%` }}
                        />
                      );
                    }
                    return (
                      <button
                        key={z.id}
                        type="button"
                        title={`${z.baslik} — düzenlemek için tıkla`}
                        aria-label={z.baslik}
                        onClick={() => odakla(z.id)}
                        className="absolute rounded border border-transparent hover:border-white/60 hover:bg-white/10 focus-visible:border-slate-300"
                        style={{ left: `${z.l}%`, top: `${z.t}%`, width: `${z.w}%`, height: `${z.h}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-amber-100/60">…</p>
            )}
            {bilgi ? (
              <p className="mt-2 text-center text-xs text-amber-100/60">
                {bilgi.musteri.ad} {bilgi.musteri.soyad} · {bilgi.ziyaret.hizmet} · {formatDate(bilgi.ziyaret.tarih, intl)} · {boyut.w}×{boyut.h}mm
              </p>
            ) : null}
            <p className="mx-auto mt-1 max-w-md text-center text-[11px] leading-snug text-amber-100/40">{t("et_kahveNot")}</p>
          </main>

          <aside className="rounded-2xl bg-black/25 p-3 backdrop-blur-md">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-100/60">⚙ {t("et_yazdirma")}</p>
            <div className={`mb-2 rounded-xl px-3 py-2 text-xs font-semibold ${port ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
              {port ? durum || t("bt_connected") : t("et_bagliDegil")}
            </div>
            {!seriVar ? <p className="mb-2 text-xs leading-relaxed text-amber-100/60">{t("bt_noserial")}</p> : null}
            {durum && port ? <p className="mb-2 text-xs text-emerald-300">{durum}</p> : null}
            {durum && !port ? <p className="mb-2 text-xs text-amber-300">{durum}</p> : null}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="text-amber-100/60">
                {t("bt_baud")}
                <select value={baud} onChange={(e) => setBaud(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-slate-900 outline-none [&>option]:text-slate-900">
                  <option value="115200">115200 (USB)</option>
                  <option value="9600">9600 (Bluetooth)</option>
                </select>
              </label>
              <label className="text-amber-100/60">
                {t("et_kopya")}
                <input value={kopya} onChange={(e) => setKopya(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-slate-900 outline-none" />
              </label>
              <label className="text-amber-100/60">
                {t("et_yogunluk")}
                <select value={yogunluk} onChange={(e) => setYogunluk(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-slate-900 outline-none [&>option]:text-slate-900">
                  <option value="1">{t("et_hafif")}</option>
                  <option value="2">{t("et_normal")}</option>
                  <option value="3">{t("et_koyu")}</option>
                </select>
              </label>
              <label className="text-amber-100/60">
                GAP (mm)
                <input value={bosluk} onChange={(e) => setBosluk(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-slate-900 outline-none" />
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
            <div className="mt-3 rounded-xl bg-sky-500/10 p-3 ring-1 ring-sky-400/40">
              <p className="mb-1 text-xs font-bold text-sky-200">🖨️ Yazıcı uyumu</p>
              <p className="text-[11px] leading-snug text-amber-100/80">
                Bu etiket baskısı <span className="font-bold text-slate-900">Phomemo D520-BT Bluetooth+USB Termal Yazıcı</span> (Barkod/Adres/Posta
                Etiketi, pazaryerleri ile uyumlu) ile uyumludur — bu yazıcıyı alın ve <span className="font-bold text-slate-900">40×60 etiket kağıdı</span> alın.
              </p>
            </div>
            <div className="mt-3 rounded-xl bg-slate-500/10 p-3 ring-1 ring-slate-400/30">
              <p className="mb-1 text-xs font-bold text-amber-200">📖 {t("et_kilavuzBaslik")}</p>
              <p className="mb-1 text-[11px] font-semibold leading-snug text-amber-100">{t("et_kilavuzUyari")}</p>
              <p className="mb-1 text-[11px] text-amber-100/70">{t("et_kilavuzModeller")}</p>
              <p className="text-[11px] leading-snug text-amber-100/60">{t("et_kilavuzAdim")}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
