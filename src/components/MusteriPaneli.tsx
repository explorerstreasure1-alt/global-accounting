"use client";

import { useEffect, useState } from "react";
import type { Musteri, Ziyaret, ZiyaretDurum } from "@/lib/types";
import { formatDate, formatMoneyLocale, toISODate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { I } from "./ui-icon";

type Detay = Musteri & { ziyaretler: Ziyaret[] };

const DURUM_RENK: Record<ZiyaretDurum, string> = {
  hazirlaniyor: "bg-amber-100 text-amber-800",
  hazir: "bg-sky-100 text-sky-800",
  teslim: "bg-emerald-100 text-emerald-800",
};

const DURUM_KEY: Record<ZiyaretDurum, string> = {
  hazirlaniyor: "mus_processing",
  hazir: "mus_ready",
  teslim: "mus_delivered",
};

/** Müşteriler: hızlı ekleme + arama + ziyaret takibi (EGZEL ARYA modülü). */
export function MusteriPaneli({ open, onClose, onEtiket }: { open: boolean; onClose: () => void; onEtiket?: (musteri: Musteri, ziyaret: Ziyaret, siraNo: number) => void }) {
  const { t, intl, currency } = useT();
  const fm = (v: number) => formatMoneyLocale(v, intl, currency);
  const [liste, setListe] = useState<Musteri[]>([]);
  const [arama, setArama] = useState("");
  const [silinmis, setSilinmis] = useState(false);
  const [secili, setSecili] = useState<Detay | null>(null);
  const [ad, setAd] = useState("");
  const [telefon, setTelefon] = useState("");
  const [hizmet, setHizmet] = useState("");
  const [tutar, setTutar] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [onaySil, setOnaySil] = useState(false);
  const [zHizmet, setZHizmet] = useState("");
  const [zTutar, setZTutar] = useState("");
  const [zTarih, setZTarih] = useState(toISODate());

  async function yukle(q = arama, s = silinmis) {
    try {
      const r = await fetch(`/api/musteriler?q=${encodeURIComponent(q)}${s ? "&silinmis=1" : ""}`);
      const j = await r.json();
      setListe(j.musteriler ?? []);
    } catch {
      setListe([]);
    }
  }

  useEffect(() => {
    if (open) {
      setSecili(null);
      setOnaySil(false);
      setArama("");
      setSilinmis(false);
      void yukle("", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || secili) return;
    const h = setTimeout(() => void yukle(), 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama, silinmis]);

  async function detayAc(id: string) {
    try {
      const r = await fetch(`/api/musteriler/${id}`);
      const j = await r.json();
      if (j.musteri) {
        setSecili(j.musteri);
        setOnaySil(false);
      }
    } catch {
      /* yoksay */
    }
  }

  async function hizliEkle() {
    if (!ad.trim() && !telefon.trim()) return;
    setMesgul(true);
    try {
      const r = await fetch("/api/musteriler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad, telefon, hizmet, tutar: Number(tutar) || 0 }),
      });
      const j = await r.json();
      setAd("");
      setTelefon("");
      setHizmet("");
      setTutar("");
      await yukle("", false);
      if (j.musteri?.id) void detayAc(j.musteri.id);
    } finally {
      setMesgul(false);
    }
  }

  async function tazeDetay(id: string) {
    await detayAc(id);
    await yukle();
  }

  async function ziyaretEkle() {
    if (!secili || (!zHizmet.trim() && !(Number(zTutar) > 0))) return;
    setMesgul(true);
    try {
      await fetch("/api/ziyaretler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musteriId: secili.id, hizmet: zHizmet, tutar: Number(zTutar) || 0, tarih: zTarih }),
      });
      setZHizmet("");
      setZTutar("");
      await tazeDetay(secili.id);
    } finally {
      setMesgul(false);
    }
  }

  async function durumDegis(id: string, durum: ZiyaretDurum) {
    await fetch("/api/ziyaretler", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, durum }),
    });
    if (secili) void tazeDetay(secili.id);
  }

  async function ziyaretSil(id: string) {
    await fetch(`/api/ziyaretler?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (secili) void tazeDetay(secili.id);
  }

  async function musteriSil() {
    if (!secili) return;
    await fetch(`/api/musteriler/${secili.id}`, { method: "DELETE" });
    setSecili(null);
    setOnaySil(false);
    await yukle();
  }

  async function musteriGeriAl() {
    if (!secili) return;
    await fetch(`/api/musteriler/${secili.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    setSecili(null);
    await yukle();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-3">
      <div className="scroll-thin my-4 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#fbf6ea] text-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 px-5 py-3">
          <div className="mr-auto flex items-center gap-2">
            {secili ? (
              <button type="button" onClick={() => { setSecili(null); void yukle(); }} className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-lg hover:bg-slate-300" title={t("mus_back")}>
                ‹
              </button>
            ) : null}
            <p className="font-hand inline-flex items-center gap-2 text-3xl leading-none">
              <I name="scissors" size={24} /> {secili ? `${secili.ad} ${secili.soyad}`.trim() : t("mus_title")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
            {t("mus_close")}
          </button>
        </div>

        <div className="px-5 py-4">
          {!secili ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-white px-3 py-2 ring-1 ring-amber-200">
                  <I name="search" size={15} className="shrink-0 text-slate-400" />
                  <input
                    value={arama}
                    onChange={(e) => setArama(e.target.value)}
                    placeholder={t("mus_search")}
                    className="w-full min-w-0 bg-transparent text-sm outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSilinmis((v) => !v)}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${silinmis ? "bg-rose-700 text-white" : "bg-amber-100 text-slate-700"}`}
                >
                  {t("mus_deleted")}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-amber-200 min-[480px]:grid-cols-4">
                <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder={t("mus_name")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder={t("mus_phone")} inputMode="tel" className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                <input value={hizmet} onChange={(e) => setHizmet(e.target.value)} placeholder={t("mus_service")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                <div className="flex gap-1.5">
                  <input value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder={t("mus_price")} inputMode="decimal" className="w-full min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                  <button type="button" disabled={mesgul} onClick={() => void hizliEkle()} className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {t("mus_add")}
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {liste.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void detayAc(m.id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 text-left ring-1 ring-amber-200 hover:bg-white"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {(m.ad || "?").slice(0, 1).toLocaleUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.ad} {m.soyad}</span>
                      <span className="block truncate text-xs text-slate-500">{m.telefon} · {m.ziyaretSayisi} {t("mus_visitCount")} · {fm(m.toplamHarcama)}</span>
                    </span>
                    <span className="shrink-0 text-lg text-slate-300">›</span>
                  </button>
                ))}
                {!liste.length ? <p className="py-8 text-center text-sm text-slate-500">{t("mus_empty")}</p> : null}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">📞 {secili.telefon || "—"}</span>
                <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">{secili.ziyaretSayisi} {t("mus_visitCount")}</span>
                <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">{t("mus_totalSpent")}: {fm(secili.toplamHarcama)}</span>
                {secili.not ? <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">📝 {secili.not}</span> : null}
              </div>

              <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t("mus_newVisit")}</p>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-amber-200 min-[480px]:grid-cols-[1fr_110px_130px_auto]">
                <input value={zHizmet} onChange={(e) => setZHizmet(e.target.value)} placeholder={t("mus_service")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                <input value={zTutar} onChange={(e) => setZTutar(e.target.value)} placeholder={t("mus_price")} inputMode="decimal" className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                <input type="date" value={zTarih} onChange={(e) => setZTarih(e.target.value)} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
                <button type="button" disabled={mesgul} onClick={() => void ziyaretEkle()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {t("mus_add")}
                </button>
              </div>

              <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t("mus_visits")} ({secili.ziyaretler.length})</p>
              <div className="space-y-1.5">
                {secili.ziyaretler.map((z, zi) => (
                  <div key={z.id} className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{z.hizmet || "—"} · {fm(z.tutar)}</p>
                      <p className="text-xs text-slate-500">{formatDate(z.tarih, intl)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${DURUM_RENK[z.durum]}`}>{t(DURUM_KEY[z.durum])}</span>
                    {z.durum === "hazirlaniyor" ? (
                      <button type="button" onClick={() => void durumDegis(z.id, "hazir")} className="shrink-0 rounded-lg bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white">
                        {t("mus_markReady")}
                      </button>
                    ) : z.durum === "hazir" ? (
                      <button type="button" onClick={() => void durumDegis(z.id, "teslim")} className="shrink-0 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">
                        {t("mus_markDelivered")}
                      </button>
                    ) : null}
                    {onEtiket && secili ? (
                      <button type="button" onClick={() => onEtiket(secili, z, secili.ziyaretler.length - zi)} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100" title={t("etiket_print")}>
                        <I name="print" size={14} />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void ziyaretSil(z.id)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" title={t("mus_delete")}>
                      <I name="delete" size={14} />
                    </button>
                  </div>
                ))}
                {!secili.ziyaretler.length ? <p className="py-4 text-center text-sm text-slate-500">{t("mus_empty")}</p> : null}
              </div>

              <div className="mt-4 border-t border-amber-200 pt-3">
                {!secili.silindi ? (
                  !onaySil ? (
                    <button type="button" onClick={() => setOnaySil(true)} className="rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">
                      {t("mus_delete")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{t("mus_confirmDelete")}</span>
                      <button type="button" onClick={() => void musteriSil()} className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white">
                        {t("mus_delete")}
                      </button>
                      <button type="button" onClick={() => setOnaySil(false)} className="rounded-lg px-3 py-1.5 text-sm">
                        {t("mus_cancel")}
                      </button>
                    </div>
                  )
                ) : (
                  <button type="button" onClick={() => void musteriGeriAl()} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                    {t("mus_restore")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
