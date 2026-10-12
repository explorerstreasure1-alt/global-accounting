"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AktifZiyaret, Musteri, Ziyaret } from "@/lib/types";
import { formatDate, formatMoneyLocale, toISODate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { waLink, waMesajKur, ziyaretKodu } from "@/lib/wa-mesaj";
import { maskAd, maskSoyad, maskTelefon } from "@/lib/gizlilik";
import { GlobalBar } from "./GlobalBar";
import { I } from "./ui-icon";

type Filtre = "tum" | "bugun" | "tekrar" | "buay" | "uzun";
type WaAyar = { dukkan: string; alindi: string; hazir: string; yorumLink: string };

function gunFarki(tarih: string): number {
  const simdi = new Date();
  const gun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const [y, m, d] = tarih.split("-").map(Number);
  if (!y || !m || !d) return 9999;
  return Math.round((gun - new Date(y, m - 1, d).getTime()) / 86400000);
}

/** Müşteri çalışma sayfası: hızlı ekleme + tablo + filtreler + işlemler paneli. */
export function MusteriSayfasi() {
  const { t, intl, currency, locale } = useT();
  const router = useRouter();
  const fm = (v: number) => formatMoneyLocale(v, intl, currency);
  const bugun = toISODate();
  const buAy = bugun.slice(0, 7);

  const [liste, setListe] = useState<Musteri[]>([]);
  const [aktif, setAktif] = useState<AktifZiyaret[]>([]);
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tum");
  const [copte, setCopte] = useState(false);
  const [detayId, setDetayId] = useState<string | null>(null);
  const [detayDuzenle, setDetayDuzenle] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [wa, setWa] = useState<WaAyar>({ dukkan: "", alindi: "", hazir: "", yorumLink: "" });
  const [tam, setTam] = useState<Record<string, { ad: string; soyad: string; telefon: string }>>({});
  const [acik, setAcik] = useState<Record<string, boolean>>({});

  /** Göz: satırdaki yıldızlı bilgiyi kart detayından (tam veri) açar/kapatır. */
  async function gozDegis(id: string) {
    if (acik[id]) {
      setAcik((a) => ({ ...a, [id]: false }));
      return;
    }
    if (!tam[id]) {
      try {
        const r = await fetch(`/api/musteriler/${id}`);
        const j = await r.json();
        if (!j.musteri) return;
        setTam((t) => ({ ...t, [id]: { ad: j.musteri.ad ?? "", soyad: j.musteri.soyad ?? "", telefon: j.musteri.telefon ?? "" } }));
      } catch {
        return;
      }
    }
    setAcik((a) => ({ ...a, [id]: true }));
  }

  /** Satır vitrini: isim hep yıldızlı, göz sadece numarayı açar. */
  function satirAd(m: Musteri): string {
    return `${maskAd(m.ad)} ${maskSoyad(m.soyad)}`.trim() || "—";
  }

  function satirTel(m: Musteri): string {
    const v = tam[m.id];
    if (acik[m.id] && v) return v.telefon || "—";
    return maskTelefon(m.telefon) || "—";
  }

  /** Numaranın yanındaki göz: yıldızları kaldırır / geri koyar. */
  function GozDugme({ id }: { id: string }) {
    const on = Boolean(acik[id]);
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void gozDegis(id); }}
        title={on ? t("mus_hide") : t("mus_show")}
        aria-label={on ? t("mus_hide") : t("mus_show")}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[12px] ring-1 ring-slate-300 hover:bg-slate-100"
      >
        {on ? "🙈" : "👁"}
      </button>
    );
  }

  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [hizmet, setHizmet] = useState("");
  const [tutar, setTutar] = useState("");

  async function yukle(q = arama, cop = copte) {
    try {
      const [l, a, y] = await Promise.all([
        fetch(`/api/musteriler?q=${encodeURIComponent(q)}${cop ? "&silinmis=1" : ""}`).then((r) => r.json()),
        fetch("/api/ziyaretler").then((r) => r.json()),
        fetch("/api/ayarlar").then((r) => r.json()),
      ]);
      setListe(l.musteriler ?? []);
      setAktif(a.aktif ?? []);
      const ay = y.ayarlar;
      if (ay) {
        setWa({
          dukkan: ay.isletmeAdi ?? "",
          alindi: ay.waSablonAlindi ?? "",
          hazir: ay.waSablonHazir ?? "",
          yorumLink: ay.googleYorumLink ?? "",
        });
      }
    } catch {
      /* yoksay */
    }
  }

  useEffect(() => {
    void yukle("", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = setTimeout(() => void yukle(), 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama, copte]);

  const suzulmus = useMemo(() => {
    return liste.filter((m) => {
      if (filtre === "bugun") return m.sonZiyaret === bugun;
      if (filtre === "tekrar") return m.ziyaretSayisi > 1;
      if (filtre === "buay") return (m.sonZiyaret ?? "").startsWith(buAy);
      if (filtre === "uzun") return !m.sonZiyaret || gunFarki(m.sonZiyaret) > 60;
      return true;
    });
  }, [liste, filtre, bugun, buAy]);

  const ozetToplam = useMemo(() => suzulmus.reduce((s, m) => s + m.toplamHarcama, 0), [suzulmus]);
  const islemde = useMemo(() => aktif.filter((a) => a.durum === "hazirlaniyor"), [aktif]);
  const hazirlar = useMemo(() => aktif.filter((a) => a.durum === "hazir"), [aktif]);

  function goreceGun(iso: string | null): string {
    if (!iso) return "—";
    const f = gunFarki(iso);
    if (f <= 0) return t("cm_bugun2");
    if (f === 1) return t("cm_gunOnce").split("{n}").join("1");
    if (f < 60) return t("cm_gunOnce").split("{n}").join(String(f));
    return formatDate(iso, intl);
  }

  async function hizliEkle() {
    if (!ad.trim() && !telefon.trim()) return;
    setMesgul(true);
    try {
      await fetch("/api/musteriler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Tam veri gönderilir (DB'de tam durur); maske sadece listede uygulanır.
        body: JSON.stringify({ ad, soyad, telefon, hizmet, tutar: Number(tutar) || 0 }),
      });
      setAd("");
      setSoyad("");
      setTelefon("");
      setHizmet("");
      setTutar("");
      await yukle("", false);
    } finally {
      setMesgul(false);
    }
  }

  function waHrefListe(m: Musteri): string | null {
    return waLink(
      m.telefon,
      waMesajKur("alindi", { ad: `${m.ad} ${m.soyad}`.trim(), hizmet: m.sonHizmet || "", dukkan: wa.dukkan, kod: "" }, locale, wa.alindi),
    );
  }

  function yorumHrefListe(m: Musteri): string | null {
    if (!wa.yorumLink || !m.telefon.replace(/\D/g, "")) return null;
    return waLink(m.telefon, waMesajKur("yorum", { ad: `${m.ad} ${m.soyad}`.trim(), dukkan: wa.dukkan, link: wa.yorumLink }, locale));
  }

  async function geriAl(id: string) {
    await fetch(`/api/musteriler/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    await yukle();
  }

  async function hazirYap(a: AktifZiyaret) {
    setMesgul(true);
    try {
      await fetch("/api/ziyaretler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, durum: "hazir" }),
      });
      const link = waLink(
        a.telefon,
        waMesajKur("hazir", { ad: `${a.ad} ${a.soyad}`.trim(), hizmet: a.hizmet, dukkan: wa.dukkan, kod: "" }, locale, wa.hazir),
      );
      await yukle();
      if (link) window.open(link, "_blank", "noopener");
    } finally {
      setMesgul(false);
    }
  }

  async function teslimEt(id: string) {
    await fetch("/api/ziyaretler", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, durum: "teslim" }),
    });
    await yukle();
  }

  async function etiketAcListe(musteriId: string) {
    try {
      const r = await fetch(`/api/musteriler/${musteriId}`);
      const j = await r.json();
      const zs: Ziyaret[] = ((j.musteri?.ziyaretler ?? []) as Ziyaret[]).slice().sort((x, y) => x.tarih.localeCompare(y.tarih));
      const z = zs[zs.length - 1];
      if (!z) return;
      router.push(`/app/etiket?m=${musteriId}&z=${z.id}&n=${zs.length}`);
    } catch {
      /* yoksay */
    }
  }

  function kartAc(id: string, duzenle = false) {
    setDetayDuzenle(duzenle);
    setDetayId(id);
  }

  const FILTRELER: Array<{ id: Filtre; ad: string }> = [
    { id: "tum", ad: t("cm_tumu") },
    { id: "bugun", ad: t("cm_bugun") },
    { id: "tekrar", ad: t("cm_tekrar") },
    { id: "buay", ad: t("cm_buAy") },
    { id: "uzun", ad: t("cm_uzunSure") },
  ];

  return (
    <div className="desk-app min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 md:px-5 md:py-4">
        <div className="mb-2">
          <GlobalBar />
        </div>

        <header className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-[24px] bg-black/25 px-3 py-2 text-amber-50 backdrop-blur-md">
          <a href="/app" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg hover:bg-white/20" title={t("mus_back")}>
            ‹
          </a>
          <img src="/images/logo.svg" alt="Shop Ledger" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-amber-200/40 sm:h-12 sm:w-12" />
          <div className="min-w-0">
            <p className="font-hand text-2xl leading-none sm:text-3xl">Shop Ledger</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-amber-100/70">{t("mus_title")}</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2">
            <I name="search" size={15} className="shrink-0 text-amber-100/70" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder={t("mus_search")}
              className="w-full min-w-0 bg-transparent text-sm text-amber-50 outline-none placeholder:text-amber-100/50"
            />
          </div>
          <button
            type="button"
            onClick={() => setCopte((v) => !v)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${copte ? "bg-rose-700 text-white" : "bg-white/10 text-amber-50"}`}
          >
            {t("mus_deleted")}
          </button>
        </header>

        <div className="no-print mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-3 min-[480px]:grid-cols-4">
          <p className="col-span-2 text-sm font-semibold text-amber-100 min-[480px]:col-span-4">{t("cm_hizliEkle")}</p>
          <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder={t("mus_name")} className="min-w-0 rounded-xl bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none" />
          <input value={soyad} onChange={(e) => setSoyad(e.target.value)} placeholder={t("mus_surname")} className="min-w-0 rounded-xl bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none" />
          <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder={t("mus_phone")} inputMode="tel" className="min-w-0 rounded-xl bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none" />
          <input value={hizmet} onChange={(e) => setHizmet(e.target.value)} placeholder={t("mus_service")} className="min-w-0 rounded-xl bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none" />
          <input value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder={t("mus_price")} inputMode="decimal" className="min-w-0 rounded-xl bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none" />
          <button type="button" disabled={mesgul} onClick={() => void hizliEkle()} className="col-span-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50 min-[480px]:col-span-2">
            {t("mus_add")}
          </button>
        </div>

        <div className="no-print mb-3 flex flex-wrap items-center gap-1.5">
          {FILTRELER.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltre(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtre === f.id ? "bg-amber-200 text-slate-900" : "bg-white/10 text-amber-50"}`}
            >
              {f.ad}
            </button>
          ))}
          <span className="ml-auto text-xs text-amber-100/70">
            {t("cm_ozet").split("{n}").join(String(suzulmus.length)).split("{t}").join(fm(ozetToplam))}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="notebook relative min-w-0 overflow-hidden rounded-[28px]">
            <div className="relative px-4 pt-4 pb-4">
              <div className="hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:grid lg:grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_90px_70px_110px_110px_minmax(0,200px)]">
                <span>#</span>
                <span>{t("mus_title")}</span>
                <span>{t("cm_sonHizmet")}</span>
                <span className="text-right">{t("cm_bedel")}</span>
                <span className="text-center">{t("cm_ziyaret")}</span>
                <span>{t("cm_sonGelis")}</span>
                <span className="text-right">{t("cm_toplam")}</span>
                <span className="text-right">{t("cm_islem")}</span>
              </div>
              <div className="mt-1 max-h-[62vh] space-y-1.5 overflow-y-auto scroll-thin pr-1">
                {suzulmus.map((m, i) => (
                  <div key={m.id}>
                    <div
                      onClick={() => kartAc(m.id)}
                      className="hidden cursor-pointer items-center gap-2 rounded-xl px-1 py-1.5 text-sm hover:bg-white/30 lg:grid lg:grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_90px_70px_110px_110px_minmax(0,200px)]"
                    >
                      <span className="tabular-nums text-slate-400">{i + 1}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                          {(m.ad || "?").slice(0, 1).toLocaleUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--ink)]">{satirAd(m)}</span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="block truncate">{satirTel(m)}</span>
                            <GozDugme id={m.id} />
                          </span>
                        </span>
                      </span>
                      <span className="truncate text-slate-600">{m.sonHizmet || "—"}</span>
                      <span className="text-right tabular-nums">{m.sonTutar ? fm(m.sonTutar) : "—"}</span>
                      <span className="text-center tabular-nums">{m.ziyaretSayisi}×</span>
                      <span className="text-xs text-slate-600">{goreceGun(m.sonZiyaret)}</span>
                      <span className="text-right font-semibold tabular-nums">{fm(m.toplamHarcama)}</span>
                      <SatirIslem m={m} />
                    </div>
                    <div onClick={() => kartAc(m.id)} className="cursor-pointer rounded-xl px-2 py-2 hover:bg-white/30 lg:hidden">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                          {(m.ad || "?").slice(0, 1).toLocaleUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--ink)]">{satirAd(m)}</span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="block truncate">{satirTel(m)} · {m.ziyaretSayisi} {t("mus_visitCount")} · {fm(m.toplamHarcama)}</span>
                            <GozDugme id={m.id} />
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <SatirIslem m={m} />
                      </div>
                    </div>
                  </div>
                ))}
                {!suzulmus.length ? <p className="font-hand py-10 text-center text-2xl text-slate-500">{t("mus_empty")}</p> : null}
              </div>
            </div>
          </div>

          <aside className="no-print min-w-0 rounded-[28px] bg-black/25 p-4 text-amber-50 backdrop-blur-md">
            <p className="font-hand text-2xl leading-none text-teal-100">{t("cm_islemler")}</p>
            <div className="mt-2 flex gap-1.5 text-xs">
              <span className="rounded-full bg-white/10 px-2.5 py-1">{t("cm_tumu")} ({aktif.length})</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{t("cm_islemde")} ({islemde.length})</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{t("cm_hazirUst")} ({hazirlar.length})</span>
            </div>
            <p className="mb-1 mt-3 text-xs font-bold uppercase tracking-wider text-amber-200/70">{t("cm_islemde")} ({islemde.length})</p>
            <div className="max-h-[30vh] space-y-1.5 overflow-y-auto scroll-thin pr-1">
              {islemde.map((a) => (
                <div key={a.id} className="rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/10">
                  <p className="truncate text-sm font-semibold">{maskAd(a.ad)} {maskSoyad(a.soyad)}</p>
                  <p className="truncate text-xs text-amber-50/70">{a.hizmet} · {fm(a.tutar)}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={mesgul}
                      onClick={() => void hazirYap(a)}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      ✓ {t("cm_hazirMesaj")}
                    </button>
                  </div>
                </div>
              ))}
              {!islemde.length ? <p className="text-xs text-amber-100/50">—</p> : null}
            </div>
            <p className="mb-1 mt-3 text-xs font-bold uppercase tracking-wider text-amber-200/70">{t("cm_hazirUst")} ({hazirlar.length})</p>
            <div className="max-h-[30vh] space-y-1.5 overflow-y-auto scroll-thin pr-1">
              {hazirlar.map((a) => (
                <div key={a.id} className="rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/10">
                  <p className="truncate text-sm font-semibold">{maskAd(a.ad)} {maskSoyad(a.soyad)}</p>
                  <p className="truncate text-xs text-amber-50/70">{a.hizmet} · {fm(a.tutar)}</p>
                  <p className="mt-0.5 text-[11px] text-amber-300">{t("cm_gunBekliyor").split("{n}").join(String(Math.max(0, gunFarki(a.tarih))))}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void teslimEt(a.id)}
                      className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                    >
                      {t("cm_teslimUst")}
                    </button>
                  </div>
                </div>
              ))}
              {!hazirlar.length ? <p className="text-xs text-amber-100/50">—</p> : null}
            </div>
          </aside>
        </div>
      </div>

      {detayId ? (
        <MusteriDetay
          id={detayId}
          wa={wa}
          locale={locale}
          duzenleAc={detayDuzenle}
          onKapat={() => {
            setDetayId(null);
            setDetayDuzenle(false);
            void yukle();
          }}
        />
      ) : null}
    </div>
  );

  function SatirIslem({ m }: { m: Musteri }) {
    // Göz açıksa WhatsApp da tam numaraya gider, yoksa vitrindeki yıldızlı veri kullanılır.
    const v = tam[m.id];
    const acikMi = Boolean(acik[m.id] && v);
    const tel = acikMi ? v.telefon : m.telefon;
    // Yıldızlı vitrin numarasıyla (4 rakam) WA linki kurulmaz — yanlış kişiye gider. Göz ile açılınca aktif olur.
    const telTam = tel.replace(/\D/g, "").length >= 10;
    const adSoyad = acikMi ? `${v.ad} ${v.soyad}`.trim() : `${m.ad} ${m.soyad}`.trim();
    // 1) Etiket/yazıcı 2) WA alındı mesajı 3) Yıldız puan mesajı 4) Kartı düzenle.
    const hrefAlindi = telTam ? waLink(
      tel,
      waMesajKur("alindi", { ad: adSoyad, hizmet: m.sonHizmet || "", dukkan: wa.dukkan, kod: "" }, locale, wa.alindi),
    ) : null;
    const hrefYorum = telTam && wa.yorumLink
      ? waLink(tel, waMesajKur("yorum", { ad: adSoyad, dukkan: wa.dukkan, link: wa.yorumLink }, locale))
      : null;
    // Yıldız hep görünür: link + tam numara varsa puan mesajı gönderir, yoksa nedenini söyler.
    const yildizNeden = !wa.yorumLink
      ? t("mus_linkFirst")
      : !telTam
        ? t("mus_eyeFirst")
        : t("mus_yorum");
    const waNeden = !telTam ? t("mus_eyeFirst") : `${t("mus_waSend")} · ${t("mus_waAlindi")}`;
    return (
      <span className="flex max-w-[190px] shrink-0 flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => void etiketAcListe(m.id)} className="grid place-items-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100" title={t("etiket_print")}>
          <I name="print" size={13} />
        </button>
        {hrefAlindi ? (
          <a href={hrefAlindi} target="_blank" rel="noreferrer" className="grid place-items-center rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100" title={`${t("mus_waSend")} · ${t("mus_waAlindi")}`}>
            <span className="text-[10px] font-black leading-none">WA</span>
          </a>
        ) : (
          <span className="grid cursor-not-allowed place-items-center rounded-lg border border-emerald-100 bg-emerald-50/50 p-2 text-emerald-300" title={waNeden}>
            <span className="text-[10px] font-black leading-none">WA</span>
          </span>
        )}
        {hrefYorum ? (
          <a href={hrefYorum} target="_blank" rel="noreferrer" className="grid place-items-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-500 hover:bg-amber-100" title={t("mus_yorum")}>
            <I name="star" size={13} />
          </a>
        ) : (
          <span className="grid cursor-not-allowed place-items-center rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-amber-400" title={yildizNeden}>
            <I name="star" size={13} />
          </span>
        )}
        <button type="button" onClick={() => kartAc(m.id, true)} className="grid place-items-center rounded-lg border border-violet-200 bg-white p-2 text-violet-700 hover:bg-violet-100" title={t("cm_duzenle")}>
          <I name="edit" size={13} />
        </button>
      </span>
    );
  }
}

function MusteriDetay({ id, wa, locale, onKapat, duzenleAc }: {
  id: string;
  wa: { dukkan: string; alindi: string; hazir: string; yorumLink: string };
  locale: string;
  onKapat: () => void;
  duzenleAc?: boolean;
}) {
  const { t, intl, currency } = useT();
  const router = useRouter();
  const fm = (v: number) => formatMoneyLocale(v, intl, currency);
  const [musteri, setMusteri] = useState<(Musteri & { ziyaretler: import("@/lib/types").Ziyaret[] }) | null>(null);
  const [duzenle, setDuzenle] = useState(duzenleAc ?? false);
  const [fAd, setFAd] = useState("");
  const [fSoyad, setFSoyad] = useState("");
  const [fTel, setFTel] = useState("");
  const [fNot, setFNot] = useState("");
  const [zHizmet, setZHizmet] = useState("");
  const [zTutar, setZTutar] = useState("");
  const [zTarih, setZTarih] = useState(toISODate());
  const [mesgul, setMesgul] = useState(false);
  const [onaySil, setOnaySil] = useState(false);

  async function yukle() {
    try {
      const r = await fetch(`/api/musteriler/${id}`);
      const j = await r.json();
      if (j.musteri) {
        setMusteri(j.musteri);
        setFAd(j.musteri.ad ?? "");
        setFSoyad(j.musteri.soyad ?? "");
        setFTel(j.musteri.telefon ?? "");
        setFNot(j.musteri.not ?? "");
      }
    } catch {
      /* yoksay */
    }
  }

  useEffect(() => {
    void yukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function kaydet() {
    if (!musteri) return;
    setMesgul(true);
    try {
      await fetch(`/api/musteriler/${musteri.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Kartta tam veri düzenlenir ve tam kaydedilir; maske sadece listededir.
        body: JSON.stringify({ ad: fAd, soyad: fSoyad, telefon: fTel, not: fNot }),
      });
      setDuzenle(false);
      await yukle();
    } finally {
      setMesgul(false);
    }
  }

  async function ziyaretEkle() {
    if (!musteri || (!zHizmet.trim() && !(Number(zTutar) > 0))) return;
    setMesgul(true);
    try {
      await fetch("/api/ziyaretler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musteriId: musteri.id, hizmet: zHizmet, tutar: Number(zTutar) || 0, tarih: zTarih }),
      });
      setZHizmet("");
      setZTutar("");
      await yukle();
    } finally {
      setMesgul(false);
    }
  }

  async function durumDegis(zid: string, durum: import("@/lib/types").ZiyaretDurum) {
    setMesgul(true);
    try {
      await fetch("/api/ziyaretler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: zid, durum }),
      });
      // Hazır olunca WhatsApp ile haber ver (PC/mobil uygulamayı, yoksa wa.me webi açar)
      if (durum === "hazir" && musteri) {
        const z = musteri.ziyaretler.find((x) => x.id === zid);
        const href = waLink(
          musteri.telefon,
          waMesajKur(
            "hazir",
            { ad: `${musteri.ad} ${musteri.soyad}`.trim(), hizmet: z?.hizmet ?? "", dukkan: wa.dukkan, kod: "" },
            locale,
            wa.hazir,
          ),
        );
        await yukle();
        if (href) window.open(href, "_blank", "noopener");
        return;
      }
      await yukle();
    } finally {
      setMesgul(false);
    }
  }

  function waHref(z: import("@/lib/types").Ziyaret, zi: number, toplam: number): string | null {
    if (!musteri) return null;
    const kind = z.durum === "hazir" ? "hazir" : z.durum === "teslim" ? "teslim" : "alindi";
    return waLink(
      musteri.telefon,
      waMesajKur(
        kind,
        {
          ad: `${musteri.ad} ${musteri.soyad}`.trim(),
          hizmet: z.hizmet,
          dukkan: wa.dukkan,
          kod: ziyaretKodu(musteri.id, toplam - zi),
        },
        locale,
        kind === "hazir" ? wa.hazir : wa.alindi,
      ),
    );
  }

  function yorumHref(): string | null {
    if (!musteri || !wa.yorumLink || !musteri.telefon.replace(/\D/g, "")) return null;
    return waLink(musteri.telefon, waMesajKur("yorum", { ad: `${musteri.ad} ${musteri.soyad}`.trim(), dukkan: wa.dukkan, link: wa.yorumLink }, locale));
  }

  if (!musteri) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-3">
      <div className="scroll-thin my-4 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#fbf6ea] text-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 px-5 py-3">
          <button type="button" onClick={onKapat} className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-lg hover:bg-slate-300" title={t("mus_back")}>
            ‹
          </button>
          <p className="font-hand mr-auto inline-flex items-center gap-2 text-3xl leading-none">
            <I name="scissors" size={24} /> {musteri.ad} {musteri.soyad}
          </p>
          <button type="button" onClick={() => setDuzenle((v) => !v)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-amber-200">
            {t("cm_duzenle")}
          </button>
          <button type="button" onClick={onKapat} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
            {t("mus_close")}
          </button>
        </div>
        <div className="px-5 py-4">
          {duzenle ? (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-amber-200">
              <input value={fAd} onChange={(e) => setFAd(e.target.value)} placeholder={t("mus_name")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
              <input value={fSoyad} onChange={(e) => setFSoyad(e.target.value)} placeholder={t("mus_surname")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
              <input value={fTel} onChange={(e) => setFTel(e.target.value)} placeholder={t("mus_phone")} inputMode="tel" className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
              <input value={fNot} onChange={(e) => setFNot(e.target.value)} placeholder={t("mus_note")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
              <button type="button" disabled={mesgul} onClick={() => void kaydet()} className="col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {t("cm_kaydet")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">📞 {musteri.telefon || "—"}</span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">{musteri.ziyaretSayisi} {t("mus_visitCount")}</span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-amber-200">{t("mus_totalSpent")}: {fm(musteri.toplamHarcama)}</span>
              {(() => {
                const yh = yorumHref(); return yh ? (
                  <a href={yh} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 ring-1 ring-amber-300">
                    <I name="spark" size={13} /> {t("mus_yorum")}
                  </a>
                ) : null;
              })()}
            </div>
          )}
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t("mus_newVisit")}</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-amber-200 min-[480px]:grid-cols-[1fr_110px_130px_auto]">
            <input value={zHizmet} onChange={(e) => setZHizmet(e.target.value)} placeholder={t("mus_service")} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
            <input value={zTutar} onChange={(e) => setZTutar(e.target.value)} placeholder={t("mus_price")} inputMode="decimal" className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
            <input type="date" value={zTarih} onChange={(e) => setZTarih(e.target.value)} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm outline-none" />
            <button type="button" disabled={mesgul} onClick={() => void ziyaretEkle()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {t("mus_add")}
            </button>
          </div>
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t("mus_visits")} ({musteri.ziyaretler.length})</p>
          <div className="space-y-1.5">
            {musteri.ziyaretler.map((z, zi) => (
              <div key={z.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200">
                <div className="min-w-[140px] flex-1">
                  <p className="truncate text-sm font-semibold">{z.hizmet || "—"} · {fm(z.tutar)}</p>
                  <p className="text-xs text-slate-500">{formatDate(z.tarih, intl)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${z.durum === "hazirlaniyor" ? "bg-amber-100 text-amber-800" : z.durum === "hazir" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{t(z.durum === "hazirlaniyor" ? "mus_processing" : z.durum === "hazir" ? "mus_ready" : "mus_delivered")}</span>
                {z.durum === "hazirlaniyor" ? (
                  <button type="button" onClick={() => void durumDegis(z.id, "hazir")} className="shrink-0 rounded-lg bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white">
                    {t("mus_markReady")}
                  </button>
                ) : z.durum === "hazir" ? (
                  <button type="button" onClick={() => void durumDegis(z.id, "teslim")} className="shrink-0 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">
                    {t("mus_markDelivered")}
                  </button>
                ) : null}
                {(() => {
                  const yh = yorumHref(); return yh ? (
                    <a href={yh} target="_blank" rel="noreferrer" className="grid shrink-0 place-items-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-500 hover:bg-amber-100" title={t("mus_yorum")}>
                      <I name="star" size={13} />
                    </a>
                  ) : null;
                })()}
                <button
                  type="button"
                  disabled={mesgul}
                  onClick={() => {
                    setMesgul(true);
                    fetch("/api/ziyaretler", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ musteriId: musteri.id, hizmet: z.hizmet, tutar: z.tutar, tarih: toISODate() }),
                    }).then(() => yukle()).finally(() => setMesgul(false));
                  }}
                  className="grid shrink-0 place-items-center rounded-lg border border-sky-200 bg-white p-2 text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                  title={t("mus_repeat")}
                >
                  <I name="refresh" size={13} />
                </button>
                {(() => {
                  const href = waHref(z, zi, musteri.ziyaretler.length); return href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="grid shrink-0 place-items-center rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-500" title={t("mus_waSend")}>
                      <I name="send" size={14} />
                    </a>
                  ) : null;
                })()}
                <button type="button" onClick={() => router.push(`/app/etiket?m=${musteri.id}&z=${z.id}&n=${musteri.ziyaretler.length - zi}`)} className="grid shrink-0 place-items-center rounded-lg p-2 text-slate-500 hover:bg-slate-100" title={t("etiket_print")}>
                  <I name="print" size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-amber-200 pt-3">
            {!musteri.silindi ? (
              !onaySil ? (
                <button type="button" onClick={() => setOnaySil(true)} className="rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">
                  {t("mus_delete")}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">{t("mus_confirmDelete")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`/api/musteriler/${musteri.id}`, { method: "DELETE" }).then(() => onKapat());
                    }}
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    {t("mus_delete")}
                  </button>
                  <button type="button" onClick={() => setOnaySil(false)} className="rounded-lg px-3 py-1.5 text-sm">
                    {t("mus_cancel")}
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  fetch(`/api/musteriler/${musteri.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ restore: true }),
                  }).then(() => onKapat());
                }}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
              >
                {t("mus_restore")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
