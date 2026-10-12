"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Musteri, Ziyaret } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { I } from "./ui-icon";
import { etiketCanvasCiz, kayitliPortlar, portAc, portBilgi, portIste, portKapat, seriDestekliMi, tsplGonder, tsplKur, type EtiketAlan, type SeriPort } from "@/lib/etiket-baski";

export type EtiketVeri = {
  musteri: Musteri;
  ziyaret: Ziyaret;
  /** Müşterinin kaçıncı ziyareti (1'den başlar) */
  siraNo: number;
  dukkan: string;
};

/** 60×40 yatay müşteri etiketi — labelife ARYA PRO şablonunun birebir tarayıcı karşılığı. */
export function EtiketModal({ veri, onClose }: { veri: EtiketVeri | null; onClose: () => void }) {
  const { t, intl } = useT();
  const [qr, setQr] = useState<string>("");
  const [seriVar, setSeriVar] = useState(false);
  const [port, setPort] = useState<SeriPort | null>(null);
  const [baud, setBaud] = useState("115200");
  const [btDurum, setBtDurum] = useState("");
  const [gonderiyor, setGonderiyor] = useState(false);

  useEffect(() => {
    setSeriVar(seriDestekliMi());
  }, []);

  function alanKur(): EtiketAlan | null {
    if (!veri) return null;
    const durumYazi = veri.ziyaret.durum === "teslim" ? t("mus_delivered") : veri.ziyaret.durum === "hazir" ? t("mus_ready") : t("mus_processing");
    return {
      adSoyad: `${veri.musteri.ad} ${veri.musteri.soyad}`.trim().toUpperCase() || "—",
      telefon: veri.musteri.telefon,
      siparisNo: `#${veri.siraNo}`,
      kod,
      sira,
      tarih: veri.ziyaret.tarih.split("-").reverse().join("."),
      durum: durumYazi,
      durumRenk: veri.ziyaret.durum === "teslim" ? "#4ade80" : veri.ziyaret.durum === "hazir" ? "#7dd3fc" : "#4a9b6f",
      dukkan: veri.dukkan,
      dukkanAlt: t("etiket_service"),
      qrIcerik,
    };
  }

  async function baglan() {
    if (port) {
      await portKapat(port);
      setPort(null);
      setBtDurum("");
      return;
    }
    const kayitli = await kayitliPortlar();
    const p = kayitli.length === 1 ? kayitli[0] : await portIste();
    if (!p) return;
    const ok = await portAc(p, Number(baud) || 115200);
    if (!ok) {
      setBtDurum(t("bt_failed"));
      return;
    }
    const b = await portBilgi(p);
    setPort(p);
    setBtDurum(`${t("bt_connected")} (${b.usb ? "USB" : "COM"})`);
  }

  async function yaziciyaGonder() {
    const alan = alanKur();
    if (!alan) return;
    if (!port) {
      setBtDurum(t("bt_need"));
      return;
    }
    setGonderiyor(true);
    try {
      const canvas = await etiketCanvasCiz(alan);
      const ok = await tsplGonder(port, tsplKur(canvas));
      if (ok) setBtDurum(t("bt_done"));
      else {
        setBtDurum(t("bt_failed"));
        await portKapat(port);
        setPort(null);
      }
    } finally {
      setGonderiyor(false);
    }
  }

  async function jpgIndir() {
    const alan = alanKur();
    if (!alan) return;
    const canvas = await etiketCanvasCiz(alan);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `etiket-${kod}.png`;
    a.click();
  }

  // Yazdırma anında sayfa ölçüsünü 60×40mm'ye kilitle (sadece modal açıkken yaşar)
  useEffect(() => {
    if (!veri) return;
    const stil = document.createElement("style");
    stil.id = "etiket-sayfa-olcusu";
    stil.textContent = "@page{size:60mm 40mm;margin:0}";
    document.head.appendChild(stil);
    return () => {
      stil.remove();
    };
  }, [veri]);

  const kod = veri ? `TZ-${veri.musteri.id.replace(/-/g, "").slice(0, 4).toUpperCase()}-${String(veri.siraNo).padStart(2, "0")}` : "";
  const sira = veri ? String(veri.siraNo).padStart(4, "0") : "";
  const qrIcerik = veri
    ? [
        "SHOP",
        kod,
        `ORDER:${veri.siraNo}`,
        `SEQ:${sira}`,
        `CUST:${veri.musteri.id.replace(/-/g, "").slice(0, 8)}`,
        `VID:${veri.ziyaret.id.replace(/-/g, "").slice(0, 8)}`,
        `NAME:${`${veri.musteri.ad} ${veri.musteri.soyad}`.trim().replace(/\|/g, "/")}`,
        `PHONE:${veri.musteri.telefon.replace(/\D/g, "")}`,
        `SERVICE:${veri.ziyaret.hizmet.replace(/\|/g, "/")}`,
        `TS:${Date.now()}`,
      ].join("|")
    : "";

  useEffect(() => {
    if (!veri || !qrIcerik) {
      setQr("");
      return;
    }
    let canlı = true;
    QRCode.toDataURL(qrIcerik, { width: 240, margin: 0, color: { dark: "#ffffff", light: "#00000000" } })
      .then((u) => {
        if (canlı) setQr(u);
      })
      .catch(() => undefined);
    return () => {
      canlı = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrIcerik, veri]);

  if (!veri) return null;

  const alan = alanKur();
  if (!alan) return null;
  const { adSoyad, tarih, durumRenk, durum: durumYazi } = alan;

  return (
    <div className="etiket-modal fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-black/60 p-4 print:static print:bg-white print:p-0">
      <div className="print-root m-auto">
        <div className="etiket-sayfa" role="img" aria-label={t("etiket_title")}>
          <span className="etk-kose etk-kose-tl" />
          <span className="etk-kose etk-kose-tr" />
          <span className="etk-kose etk-kose-bl" />
          <span className="etk-kose etk-kose-br" />
          <span className="etk-dukkan">{veri.dukkan.toUpperCase() || "SHOP"}</span>
          <span className="etk-alt">{t("etiket_service")}</span>
          {qr ? <img src={qr} alt="QR" className="etk-qr" /> : null}
          <span className="etk-ad">{adSoyad}</span>
          <span className="etk-tel">{veri.musteri.telefon.toUpperCase() || "---"}</span>
          <span className="etk-sip">#{veri.siraNo}</span>
          <span className="etk-kod">{kod}</span>
          <span className="etk-sira">{sira}</span>
          <span className="etk-tarih">{tarih}</span>
          <span className="etk-durum" style={{ color: durumRenk }}>{durumYazi.toLocaleUpperCase(intl)}</span>
        </div>
        <div className="no-print mt-4 space-y-2">
          {seriVar ? (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${port ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/70"}`}>
                <span className={`h-2 w-2 rounded-full ${port ? "bg-emerald-400" : "bg-white/40"}`} />
                {port ? btDurum || t("bt_connected") : t("bt_off")}
              </span>
              <label className="inline-flex items-center gap-1 text-white/70">
                {t("bt_baud")}
                <select value={baud} onChange={(e) => setBaud(e.target.value)} className="rounded-lg bg-white/10 px-2 py-1.5 text-white outline-none [&>option]:text-slate-900">
                  <option value="115200">115200 (USB)</option>
                  <option value="9600">9600 (Bluetooth)</option>
                </select>
              </label>
              <button type="button" onClick={() => void baglan()} className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white">
                {port ? t("bt_disconnect") : t("bt_connect")}
              </button>
            </div>
          ) : (
            <p className="mx-auto max-w-sm text-center text-xs leading-relaxed text-white/70">{t("bt_noserial")}</p>
          )}
          {btDurum && port ? <p className="text-center text-xs text-emerald-200">{btDurum}</p> : null}
          {btDurum && !port ? <p className="text-center text-xs text-amber-200">{btDurum}</p> : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {seriVar ? (
              <button type="button" disabled={gonderiyor} onClick={() => void yaziciyaGonder()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                <I name="send" size={15} /> {gonderiyor ? t("bt_printing") : t("bt_print")}
              </button>
            ) : null}
            <button type="button" onClick={() => void jpgIndir()} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">
              <I name="download" size={15} /> {t("bt_jpg")}
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
              <I name="print" size={15} /> {t("etiket_print")}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white">
              {t("mus_close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
