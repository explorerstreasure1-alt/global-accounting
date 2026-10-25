"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cihazEtiketi } from "@/lib/cihaz";

/**
 * YÖNETİCİ PANELİ (/admin)
 * Gizli şifre ile girilir (env ADMIN_PASSWORD).
 *
 * Sekmeler:
 *  - Özet: KPI'lar, 30 gün grafiği, 24 saat grafiği, ülke/cihaz/sayfa dağılımı
 *  - Canlı akış: kim, ne zaman, hangi sayfa, ülke, IP, cihaz
 *  - Kişiler: giriş/sayfa sayısı, ilk/son görülme, ülke, IP, cihaz
 *  - Günlük: gün bazında ziyaret + girenler ve günlük tablo
 *
 * Veriler sunucuda doğrulanır: e-posta yalnızca Supabase jetonundan okunur.
 */
type Olay = {
  olusturma: string;
  olay: "ziyaret" | "giris";
  kaynak: string;
  email: string | null;
  ulke: string;
  yol: string;
  ip: string;
  cihaz: string;
};

type Kisi = {
  email: string;
  giris: number;
  sayfa: number;
  ilk: string;
  son: string;
  ulke: string;
  ip: string;
  cihaz: string;
  sonYol: string;
  kaynak: string;
};

type GunSatiri = {
  gun: string;
  ziyaret: number;
  giris: number;
  google: number;
  parola: number;
  kullanan: number;
};

type GunKisi = { email: string; adet: number; ulke: string; kaynak: string; son: string };

type GunDetay = {
  gun: string;
  ziyaret: number;
  giris: number;
  google: number;
  parola: number;
  kisiler: GunKisi[];
};

type SaatSatiri = {
  saat: string;
  etiket: string;
  gun: string;
  ziyaret: number;
  giris: number;
  tekil: number;
};

type Dagilim = { etiket: string; adet: number };
type Ulke = { ulke: string; adet: number; tekil: number };
type Sayfa = { yol: string; ziyaret: number; girisli: number; tekil: number };
type HaftaninGunu = { gun: string; adet: string; ziyaret: number; giris: number; tekil: number };
type OturumSuresi = { ortalamaDakika: number; medyanDakika: number; oturumSayisi: number };
type HemenCikma = { toplamZiyaretci: number; hemenCikan: number; oran: number };
type YeniGeriDonen = { yeniKisi: number; geriDonen: number; toplam: number; yeniOran: number; geriOran: number };
type SayfaDonusum = { yol: string; ziyaret: number; girisli: number; donusumOrani: number };
type TrafficSource = { kaynak: string; adet: number; tekil: number; donusum: number };
type AylikKarsilastirma = {
  buAy: string;
  oncekiAy: string;
  buAyZiyaret: number;
  oncekiAyZiyaret: number;
  buAyGiris: number;
  oncekiAyGiris: number;
  buAyTekil: number;
  oncekiAyTekil: number;
  ziyaretDegisim: number;
  girisDegisim: number;
  tekilDegisim: number;
};
type CohortSatiri = { hafta: string; yeniKisi: number; hafta1: number; hafta2: number; hafta3: number; hafta4: number };

type Veri = {
  ok: boolean;
  buAy: string;
  veriZamani: string;
  mod: "supabase" | "dosya";
  ziyaretBuAy: number;
  girisBuAy: number;
  googleBuAy: number;
  parolaBuAy: number;
  kayitBuAy: number;
  kullananBuAy: number;
  tekilZiyaretciBuAy: number;
  girisKisiBuAy: number;
  donusumBuAy: number;
  bugunZiyaret: number;
  bugunGiris: number;
  bugunTekil: number;
  bugunTekilZiyaretci: number;
  bugunGirisKisi: number;
  bugunDonusum: number;
  ziyaretci30: number;
  girisKisi30: number;
  gunluk: GunSatiri[];
  gunDetay: GunDetay[];
  kullanicilar: { email: string; adet: number; sonGiris: string; ulke: string; kaynak: string }[];
  kullaniciDetay: Kisi[];
  sonOlaylar: Olay[];
  ulkeler: Ulke[];
  sonUlke: { ulke: string; zaman: string; email?: string };
  epostalar: { email: string; sonZaman: string; adet: number }[];
  saatlik: SaatSatiri[];
  sayfalar: Sayfa[];
  tarayicilar: Dagilim[];
  isletimler: Dagilim[];
  cihazTurleri: Dagilim[];
  kaynaklar: Dagilim[];
  devamlilik: { kisi: number; tekGun: number; cokGun: number; ortGiris: number; ortSayfa: number };
  canli: { dakika: number; kisi: number; ziyaret: number; giris: number };
  haftaninGunleri: HaftaninGunu[];
  oturumSuresi: OturumSuresi;
  hemenCikma: HemenCikma;
  yeniGeriDonen: YeniGeriDonen;
  sayfaDonusum: SayfaDonusum[];
  trafficSource: TrafficSource[];
  aylikKarsilastirma: AylikKarsilastirma;
  cohort: CohortSatiri[];
  trend: {
    bugunZiyaret: number;
    bugunGiris: number;
    dunZiyaret: number;
    dunGiris: number;
    yediZiyaret: number;
    yediGiris: number;
    oncekiYediZiyaret: number;
    oncekiYediGiris: number;
  };
  ozet: {
    aktifGun: number;
    enYogunGun: string;
    enYogunZiyaret: number;
    ortGunlukZiyaret: number;
    sonOlayZamani: string;
    toplamZiyaret30: number;
  };
  ipKolonu: boolean;
  olaySayisi: number;
  buAyOlaySayisi: number;
  son30OlaySayisi: number;
  kirpildi: boolean;
  uyari?: string;
  uyarilar?: string[];
  projeRef?: string;
};

type Sekme = "ozet" | "canli" | "kisiler" | "gunluk";
type OlayFiltre = "hepsi" | "ziyaret" | "giris";
type KisiSirala = "son" | "giris" | "sayfa" | "email";

const GUNLER_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const sayiFmt = new Intl.NumberFormat("tr-TR");

function sayi(n: number | string): string {
  if (typeof n === "string") return n;
  return Number.isFinite(n) ? sayiFmt.format(n) : "—";
}

function yuzde(x: number, basamak = 1): string {
  if (!Number.isFinite(x)) return "—";
  const v = x * 100;
  return `%${v.toFixed(basamak).replace(".", ",")}`;
}

function trendYuzde(simdi: number, once: number): number | null {
  if (!Number.isFinite(simdi) || !Number.isFinite(once)) return null;
  if (once === 0) return null;
  return ((simdi - once) / once) * 100;
}

function gunYaz(gun: string): string {
  const [y, m, d] = gun.split("-").map(Number);
  if (!y || !m || !d) return gun;
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")} ${GUNLER_TR[t.getUTCDay()]}`;
}

function tamZaman(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function saatZaman(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function gecenSure(iso: string, simdi: number): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const sn = Math.max(0, Math.round((simdi - t) / 1000));
  if (sn < 45) return "az önce";
  if (sn < 3600) return `${Math.floor(sn / 60)} dk önce`;
  if (sn < 86400) return `${Math.floor(sn / 3600)} sa önce`;
  return `${Math.floor(sn / 86400)} gün önce`;
}

function bayrak(kod: string): string {
  if (!/^[A-Za-z]{2}$/.test(kod)) return "🌐";
  return String.fromCodePoint(...kod.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
}

let bolgeAdlari: Intl.DisplayNames | null | undefined;
function ulkeAdi(kod: string): string {
  if (!kod) return "Bilinmiyor";
  try {
    if (bolgeAdlari === undefined) {
      bolgeAdlari = typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames(["tr"], { type: "region" })
        : null;
    }
    return bolgeAdlari?.of(kod) ?? kod;
  } catch {
    return kod;
  }
}

function kaynakYaz(kaynak: string): string {
  if (kaynak === "google") return "Google";
  if (kaynak === "parola") return "Şifre";
  if (kaynak === "kayit") return "Yeni kayıt";
  return "Bilinmiyor";
}

/* ------------------------------------------------------------------ */
/* Küçük arayüz parçaları                                              */
/* ------------------------------------------------------------------ */

function Kpi({
  etiket,
  deger,
  alt,
  trend,
  trendEtiket,
  vurgu = false,
}: {
  etiket: string;
  deger: number | string;
  alt?: string;
  trend?: number | null;
  trendEtiket?: string;
  vurgu?: boolean;
}) {
  const t = typeof trend === "number" ? trend : null;
  return (
    <div
      className={`rounded-2xl bg-white p-3.5 shadow-sm ring-1 ${vurgu ? "ring-teal-300" : "ring-slate-200"
        }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{etiket}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <p className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-[28px]">{deger}</p>
        {t !== null ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${t > 0
              ? "bg-emerald-50 text-emerald-700"
              : t < 0
                ? "bg-rose-50 text-rose-700"
                : "bg-slate-100 text-slate-500"
              }`}
            title={trendEtiket}
          >
            {t > 0 ? "▲" : t < 0 ? "▼" : "•"} {Math.abs(t).toFixed(1).replace(".", ",")}%
          </span>
        ) : null}
      </div>
      {alt ? <p className="mt-0.5 text-[11px] text-slate-500">{alt}</p> : null}
      {trendEtiket ? <p className="mt-0.5 text-[10px] text-slate-400">{trendEtiket}</p> : null}
    </div>
  );
}

function SekmeDugmesi({
  aktif,
  ad,
  rozet,
  onClick,
}: {
  aktif: boolean;
  ad: string;
  rozet?: string | number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktif}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${aktif
        ? "bg-slate-900 text-white shadow-sm"
        : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        }`}
    >
      {ad}
      {rozet !== undefined ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${aktif ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
            }`}
        >
          {rozet}
        </span>
      ) : null}
    </button>
  );
}

/** 30 günlük ziyaret & giriş grafiği (bağımlılıksız SVG). */
function GunGrafigi({ gunluk }: { gunluk: GunSatiri[] }) {
  const enBuyuk = Math.max(1, ...gunluk.map((g) => Math.max(g.ziyaret, g.giris)));
  const adim = Math.max(1, Math.ceil(enBuyuk / 4));
  const tepe = adim * 4;
  const genislik = 680;
  const yukseklik = 232;
  const sol = 30;
  const sag = 10;
  const ust = 12;
  const alt = 28;
  const cizimG = genislik - sol - sag;
  const cizimY = yukseklik - ust - alt;
  const grupG = cizimG / Math.max(1, gunluk.length);
  const cubukG = Math.max(3, Math.min(9, grupG * 0.32));
  const ziyaretToplam = gunluk.reduce((t, g) => t + g.ziyaret, 0);
  const girisToplam = gunluk.reduce((t, g) => t + g.giris, 0);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Son 30 gün</h3>
          <p className="text-[11px] text-slate-500">
            Toplam {sayi(ziyaretToplam)} sayfa açılışı · {sayi(girisToplam)} oturum
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Ziyaret
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" /> Giriş
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${genislik} ${yukseklik}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label="Son 30 günlük ziyaret ve giriş grafiği"
      >
        <title>Son 30 günlük ziyaret ve giriş sayıları</title>
        {[0, 1, 2, 3, 4].map((k) => {
          const y = ust + cizimY - (k / 4) * cizimY;
          return (
            <g key={k}>
              <line x1={sol} x2={genislik - sag} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={sol - 5} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px]">
                {sayi(Math.round((tepe * k) / 4))}
              </text>
            </g>
          );
        })}

        {gunluk.map((g, i) => {
          const x = sol + i * grupG;
          const zYuk = (g.ziyaret / tepe) * cizimY;
          const rYuk = (g.giris / tepe) * cizimY;
          const bugun = i === gunluk.length - 1;
          return (
            <g key={g.gun}>
              {bugun ? (
                <rect
                  x={x}
                  y={ust}
                  width={grupG}
                  height={cizimY}
                  fill="#f0fdfa"
                  opacity={0.75}
                />
              ) : null}
              <rect
                x={x + grupG / 2 - cubukG - 0.5}
                y={ust + cizimY - Math.max(g.ziyaret ? 2 : 0, zYuk)}
                width={cubukG}
                height={Math.max(g.ziyaret ? 2 : 0, zYuk)}
                rx={1.5}
                fill={bugun ? "#0d9488" : "#14b8a6"}
              />
              <rect
                x={x + grupG / 2 + 0.5}
                y={ust + cizimY - Math.max(g.giris ? 2 : 0, rYuk)}
                width={cubukG}
                height={Math.max(g.giris ? 2 : 0, rYuk)}
                rx={1.5}
                fill={bugun ? "#0f172a" : "#1e293b"}
              />
              <title>{`${gunYaz(g.gun)} — ziyaret: ${g.ziyaret}, giriş: ${g.giris}, kullanan: ${g.kullanan}`}</title>
            </g>
          );
        })}

        <line
          x1={sol}
          x2={genislik - sag}
          y1={ust + cizimY}
          y2={ust + cizimY}
          stroke="#cbd5e1"
          strokeWidth={1}
        />

        {gunluk.map((g, i) => {
          const son = i === gunluk.length - 1;
          if (!son && i % 5 !== 0) return null;
          return (
            <text
              key={`x-${g.gun}`}
              x={sol + i * grupG + grupG / 2}
              y={yukseklik - 8}
              textAnchor="middle"
              className={`text-[9px] ${son ? "fill-teal-700 font-bold" : "fill-slate-400"}`}
            >
              {son ? "bugün" : g.gun.slice(8, 10)}
            </text>
          );
        })}
      </svg>
      <p className="text-[10px] text-slate-400">Teal = sayfa açan, koyu = oturum açan. Bugün vurgulanır.</p>
    </div>
  );
}

/** Haftanın günleri grafiği (bar chart). */
function HaftaGrafigi({ hafta }: { hafta: HaftaninGunu[] }) {
  const enBuyuk = Math.max(1, ...hafta.map((h) => h.ziyaret));
  const genislik = 680;
  const yukseklik = 180;
  const sol = 30;
  const sag = 10;
  const ust = 10;
  const alt = 24;
  const cizimG = genislik - sol - sag;
  const cizimY = yukseklik - ust - alt;
  const grupG = cizimG / hafta.length;
  const cubukG = Math.max(8, Math.min(20, grupG * 0.4));

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Haftanın günleri</h3>
          <p className="text-[11px] text-slate-500">Son 30 gün · hangi günler daha yoğun</p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${genislik} ${yukseklik}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label="Haftanın günleri dağılımı"
      >
        <title>Haftanın günlerine göre ziyaret sayısı</title>
        {[0, 0.5, 1].map((k) => {
          const y = ust + cizimY - k * cizimY;
          return (
            <g key={k}>
              <line x1={sol} x2={genislik - sag} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={sol - 4} y={y + 3} textAnchor="end" className="fill-slate-400 text-[8px]">
                {sayi(Math.round(enBuyuk * k))}
              </text>
            </g>
          );
        })}
        {hafta.map((h, i) => {
          const x = sol + i * grupG;
          const yuk = (h.ziyaret / enBuyuk) * cizimY;
          return (
            <g key={h.gun}>
              <rect
                x={x + grupG / 2 - cubukG / 2}
                y={ust + cizimY - Math.max(h.ziyaret ? 1.5 : 0, yuk)}
                width={cubukG}
                height={Math.max(h.ziyaret ? 1.5 : 0, yuk)}
                rx={2}
                fill="#14b8a6"
              />
              <title>{`${h.gun}: ${sayi(h.ziyaret)} ziyaret, ${sayi(h.giris)} giriş, ${sayi(h.tekil)} tekil kişi`}</title>
            </g>
          );
        })}
        <line x1={sol} x2={genislik - sag} y1={ust + cizimY} y2={ust + cizimY} stroke="#cbd5e1" strokeWidth={1} />
        {hafta.map((h, i) => (
          <text
            key={`x-${h.gun}`}
            x={sol + i * grupG + grupG / 2}
            y={yukseklik - 6}
            textAnchor="middle"
            className="fill-slate-400 text-[8px]"
          >
            {h.gun.slice(0, 3)}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Son 24 saatin saatlik grafiği. */
function SaatGrafigi({ saatlik }: { saatlik: SaatSatiri[] }) {
  const enBuyuk = Math.max(1, ...saatlik.map((s) => Math.max(s.ziyaret, s.giris)));
  const genislik = 680;
  const yukseklik = 160;
  const sol = 26;
  const sag = 8;
  const ust = 10;
  const alt = 26;
  const cizimG = genislik - sol - sag;
  const cizimY = yukseklik - ust - alt;
  const grupG = cizimG / Math.max(1, saatlik.length);
  const cubukG = Math.max(2, Math.min(10, grupG * 0.36));
  const ziyaretToplam = saatlik.reduce((t, s) => t + s.ziyaret, 0);
  const girisToplam = saatlik.reduce((t, s) => t + s.giris, 0);
  const tekil = saatlik.length ? saatlik[saatlik.length - 1].tekil : 0;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Son 24 saat</h3>
          <p className="text-[11px] text-slate-500">
            {sayi(ziyaretToplam)} sayfa · {sayi(girisToplam)} giriş · son saatte {sayi(tekil)} kişi
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Ziyaret
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" /> Giriş
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${genislik} ${yukseklik}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label="Son 24 saatin saatlik ziyaret ve giriş grafiği"
      >
        <title>Son 24 saat saatlik hareket</title>
        {[0, 0.5, 1].map((k) => {
          const y = ust + cizimY - k * cizimY;
          return (
            <g key={k}>
              <line x1={sol} x2={genislik - sag} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={sol - 4} y={y + 3} textAnchor="end" className="fill-slate-400 text-[8px]">
                {sayi(Math.round(enBuyuk * k))}
              </text>
            </g>
          );
        })}
        {saatlik.map((s, i) => {
          const x = sol + i * grupG;
          const zYuk = (s.ziyaret / enBuyuk) * cizimY;
          const rYuk = (s.giris / enBuyuk) * cizimY;
          const son = i === saatlik.length - 1;
          return (
            <g key={s.saat}>
              {son ? (
                <rect x={x} y={ust} width={grupG} height={cizimY} fill="#f0fdfa" opacity={0.8} />
              ) : null}
              <rect
                x={x + grupG / 2 - cubukG - 0.5}
                y={ust + cizimY - Math.max(s.ziyaret ? 1.5 : 0, zYuk)}
                width={cubukG}
                height={Math.max(s.ziyaret ? 1.5 : 0, zYuk)}
                rx={1}
                fill={son ? "#0d9488" : "#14b8a6"}
              />
              <rect
                x={x + grupG / 2 + 0.5}
                y={ust + cizimY - Math.max(s.giris ? 1.5 : 0, rYuk)}
                width={cubukG}
                height={Math.max(s.giris ? 1.5 : 0, rYuk)}
                rx={1}
                fill={son ? "#0f172a" : "#1e293b"}
              />
              <title>{`${s.gun} ${s.etiket} — ziyaret: ${s.ziyaret}, giriş: ${s.giris}, tekil: ${s.tekil}`}</title>
            </g>
          );
        })}
        <line x1={sol} x2={genislik - sag} y1={ust + cizimY} y2={ust + cizimY} stroke="#cbd5e1" strokeWidth={1} />
        {saatlik.map((s, i) => {
          if (i % 3 !== 0 && i !== saatlik.length - 1) return null;
          return (
            <text
              key={`x-${s.saat}`}
              x={sol + i * grupG + grupG / 2}
              y={yukseklik - 7}
              textAnchor="middle"
              className="fill-slate-400 text-[8px]"
            >
              {s.etiket.slice(0, 2)}
            </text>
          );
        })}
      </svg>
      <p className="text-[10px] text-slate-400">Saatler İstanbul (UTC+3).</p>
    </div>
  );
}

type DagilimGirdi = { etiket: string; adet: number; alt?: string };

function DagilimKarti({
  baslik,
  alt,
  satirlar,
  limit = 6,
  bos = "Kayıt yok",
}: {
  baslik: string;
  alt?: string;
  satirlar: DagilimGirdi[];
  limit?: number;
  bos?: string;
}) {
  const goster = satirlar.slice(0, limit);
  const enBuyuk = Math.max(1, ...goster.map((s) => s.adet));
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{baslik}</h3>
        {alt ? <span className="text-[10px] text-slate-400">{alt}</span> : null}
      </div>
      {goster.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">{bos}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {goster.map((s) => (
            <li key={s.etiket}>
              <div className="flex items-baseline gap-2 text-xs text-slate-700">
                <span className="min-w-0 flex-1 truncate" title={s.etiket}>
                  {s.etiket}
                </span>
                {s.alt ? <span className="text-[10px] text-slate-400">{s.alt}</span> : null}
                <b className="tabular-nums text-slate-900">{sayi(s.adet)}</b>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-500"
                  style={{ width: `${Math.max(2, (s.adet / enBuyuk) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sekme içerikleri                                                    */
/* ------------------------------------------------------------------ */

function OzetSekmesi({ veri }: { veri: Veri }) {
  const t = veri.trend;
  const dunZiyaretTrend = trendYuzde(t.bugunZiyaret, t.dunZiyaret);
  const dunGirisTrend = trendYuzde(t.bugunGiris, t.dunGiris);
  const haftaZiyaretTrend = trendYuzde(t.yediZiyaret, t.oncekiYediZiyaret);
  const haftaGirisTrend = trendYuzde(t.yediGiris, t.oncekiYediGiris);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          etiket="Bugün ziyaret"
          deger={sayi(veri.bugunZiyaret)}
          alt={`${sayi(veri.bugunTekilZiyaretci)} tekil ziyaretçi`}
          trend={dunZiyaretTrend}
          trendEtiket={`Düne göre · dün ${sayi(t.dunZiyaret)}`}
          vurgu
        />
        <Kpi
          etiket="Bugün giriş"
          deger={sayi(veri.bugunGiris)}
          alt={`${sayi(veri.bugunGirisKisi)} kişi oturum açtı`}
          trend={dunGirisTrend}
          trendEtiket={`Düne göre · dün ${sayi(t.dunGiris)}`}
          vurgu
        />
        <Kpi
          etiket="Bugün dönüşüm"
          deger={yuzde(veri.bugunDonusum)}
          alt={`${sayi(veri.bugunGirisKisi)} / ${sayi(veri.bugunTekilZiyaretci)} ziyaretçi`}
          trend={null}
        />
        <Kpi
          etiket="Son 7 gün"
          deger={sayi(t.yediZiyaret)}
          alt={`${sayi(t.yediGiris)} giriş · ${sayi(veri.ziyaretci30)} kişi (30 gün)`}
          trend={haftaZiyaretTrend}
          trendEtiket={`Önceki 7 güne göre · giriş ${haftaGirisTrend === null ? "—" : `%${haftaGirisTrend.toFixed(1).replace(".", ",")}`}`}
        />

        <Kpi
          etiket="Bu ay ziyaret"
          deger={sayi(veri.ziyaretBuAy)}
          alt={`Günlük ortalama ${sayi(veri.ozet.ortGunlukZiyaret)}`}
        />
        <Kpi
          etiket="Bu ay giriş"
          deger={sayi(veri.girisBuAy)}
          alt={`${sayi(veri.girisKisiBuAy)} farklı kişi`}
        />
        <Kpi
          etiket="Bu ay dönüşüm"
          deger={yuzde(veri.donusumBuAy)}
          alt={`${sayi(veri.girisKisiBuAy)} giriş / ${sayi(veri.tekilZiyaretciBuAy)} ziyaretçi`}
        />
        <Kpi
          etiket="Kullanan kişi"
          deger={sayi(veri.kullananBuAy)}
          alt={`${sayi(veri.ziyaretBuAy)} ziyaret · ${veri.buAy}`}
        />

        <Kpi etiket="Google girişi" deger={sayi(veri.googleBuAy)} alt="Bu ay · G ile giriş" />
        <Kpi etiket="Şifreli giriş" deger={sayi(veri.parolaBuAy)} alt="Bu ay · e-posta + şifre" />
        <Kpi etiket="Yeni kayıt" deger={sayi(veri.kayitBuAy)} alt="Bu ay · kayıt sonrası oturum" />
        <Kpi
          etiket="30 gün tekil kişi"
          deger={sayi(veri.ziyaretci30)}
          alt={`${sayi(veri.girisKisi30)} kişi giriş yaptı`}
        />

        <Kpi
          etiket="Ort. oturum süresi"
          deger={`${sayi(veri.oturumSuresi.ortalamaDakika)} dk`}
          alt={`Medyan ${sayi(veri.oturumSuresi.medyanDakika)} dk · ${sayi(veri.oturumSuresi.oturumSayisi)} oturum`}
        />
        <Kpi
          etiket="Hemen çıkma oranı"
          deger={yuzde(veri.hemenCikma.oran)}
          alt={`${sayi(veri.hemenCikma.hemenCikan)} / ${sayi(veri.hemenCikma.toplamZiyaretci)} ziyaretçi`}
        />
        <Kpi
          etiket="Yeni kullanıcı"
          deger={yuzde(veri.yeniGeriDonen.yeniOran)}
          alt={`${sayi(veri.yeniGeriDonen.yeniKisi)} yeni · ${sayi(veri.yeniGeriDonen.geriDonen)} geri dönen`}
        />
        <Kpi
          etiket="Geri dönen"
          deger={yuzde(veri.yeniGeriDonen.geriOran)}
          alt={`Toplam ${sayi(veri.yeniGeriDonen.toplam)} kayıtlı kullanıcı`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GunGrafigi gunluk={veri.gunluk} />
        </div>
        <section className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">Canlı</p>
            <span className="ml-auto text-[10px] text-slate-400">son {veri.canli.dakika} dk</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-extrabold tabular-nums">{sayi(veri.canli.kisi)}</p>
              <p className="text-[10px] text-slate-400">kişi</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums">{sayi(veri.canli.ziyaret)}</p>
              <p className="text-[10px] text-slate-400">sayfa</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums">{sayi(veri.canli.giris)}</p>
              <p className="text-[10px] text-slate-400">giriş</p>
            </div>
          </div>
          <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Aktif gün</dt>
              <dd className="font-bold tabular-nums">{veri.ozet.aktifGun} / 30</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Günlük ortalama</dt>
              <dd className="font-bold tabular-nums">{sayi(veri.ozet.ortGunlukZiyaret)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">En yoğun gün</dt>
              <dd className="truncate font-bold">
                {veri.ozet.enYogunGun ? `${gunYaz(veri.ozet.enYogunGun)} · ${sayi(veri.ozet.enYogunZiyaret)}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Son hareket</dt>
              <dd className="truncate font-bold">{veri.ozet.sonOlayZamani ? saatZaman(veri.ozet.sonOlayZamani) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Tek gün / çok gün</dt>
              <dd className="font-bold tabular-nums">
                {sayi(veri.devamlilik.tekGun)} / {sayi(veri.devamlilik.cokGun)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Kişi başına</dt>
              <dd className="font-bold tabular-nums">
                {sayi(veri.devamlilik.ortGiris)} giriş · {sayi(veri.devamlilik.ortSayfa)} sayfa
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            Canlı sayı, son {veri.canli.dakika} dakikada sayfa açan veya giriş yapan tekil kişilerdir.
          </p>
        </section>
      </div>

      <SaatGrafigi saatlik={veri.saatlik} />

      <HaftaGrafigi hafta={veri.haftaninGunleri} />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <DagilimKarti
          baslik="Ülkeler"
          alt="son 30 gün"
          satirlar={veri.ulkeler.map((u) => ({
            etiket: `${bayrak(u.ulke)} ${ulkeAdi(u.ulke)}`,
            adet: u.adet,
            alt: u.tekil > 0 ? `${sayi(u.tekil)} kişi` : undefined,
          }))}
        />
        <DagilimKarti baslik="Tarayıcı" alt="tekil kişi" satirlar={veri.tarayicilar} />
        <DagilimKarti baslik="İşletim sistemi" alt="tekil kişi" satirlar={veri.isletimler} />
        <DagilimKarti baslik="Cihaz türü" alt="tekil kişi" satirlar={veri.cihazTurleri} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Traffic kaynakları</h3>
            <span className="text-[10px] text-slate-400">son 30 gün</span>
          </div>
          {veri.trafficSource.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Kayıt yok</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {veri.trafficSource.map((t) => {
                const toplam = Math.max(1, veri.trafficSource.reduce((sum, x) => sum + x.adet, 0));
                return (
                  <li key={t.kaynak}>
                    <div className="flex items-baseline gap-2 text-xs text-slate-700">
                      <span className="flex-1 font-semibold">{t.kaynak}</span>
                      <span className="text-[10px] text-slate-400">{yuzde(t.adet / toplam)}</span>
                      <b className="tabular-nums text-slate-900">{sayi(t.adet)}</b>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800"
                        style={{ width: `${Math.max(2, (t.adet / Math.max(...veri.trafficSource.map((x) => x.adet))) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {sayi(t.tekil)} tekil · {yuzde(t.donusum)} dönüşüm
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Aylık karşılaştırma</h3>
            <span className="text-[10px] text-slate-400">{veri.aylikKarsilastirma.buAy} vs {veri.aylikKarsilastirma.oncekiAy}</span>
          </div>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Ziyaret</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{sayi(veri.aylikKarsilastirma.oncekiAyZiyaret)} →</span>
                <b className="text-sm tabular-nums text-slate-900">{sayi(veri.aylikKarsilastirma.buAyZiyaret)}</b>
                <span
                  className={`text-[10px] font-bold ${veri.aylikKarsilastirma.ziyaretDegisim > 0
                    ? "text-emerald-600"
                    : veri.aylikKarsilastirma.ziyaretDegisim < 0
                      ? "text-rose-600"
                      : "text-slate-500"
                    }`}
                >
                  {veri.aylikKarsilastirma.ziyaretDegisim > 0 ? "+" : ""}{veri.aylikKarsilastirma.ziyaretDegisim.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Giriş</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{sayi(veri.aylikKarsilastirma.oncekiAyGiris)} →</span>
                <b className="text-sm tabular-nums text-slate-900">{sayi(veri.aylikKarsilastirma.buAyGiris)}</b>
                <span
                  className={`text-[10px] font-bold ${veri.aylikKarsilastirma.girisDegisim > 0
                    ? "text-emerald-600"
                    : veri.aylikKarsilastirma.girisDegisim < 0
                      ? "text-rose-600"
                      : "text-slate-500"
                    }`}
                >
                  {veri.aylikKarsilastirma.girisDegisim > 0 ? "+" : ""}{veri.aylikKarsilastirma.girisDegisim.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Tekil kişi</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{sayi(veri.aylikKarsilastirma.oncekiAyTekil)} →</span>
                <b className="text-sm tabular-nums text-slate-900">{sayi(veri.aylikKarsilastirma.buAyTekil)}</b>
                <span
                  className={`text-[10px] font-bold ${veri.aylikKarsilastirma.tekilDegisim > 0
                    ? "text-emerald-600"
                    : veri.aylikKarsilastirma.tekilDegisim < 0
                      ? "text-rose-600"
                      : "text-slate-500"
                    }`}
                >
                  {veri.aylikKarsilastirma.tekilDegisim > 0 ? "+" : ""}{veri.aylikKarsilastirma.tekilDegisim.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">En çok açılan sayfalar</h3>
            <span className="text-[10px] text-slate-400">son 30 gün</span>
          </div>
          {veri.sayfalar.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Kayıt yok</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-1 pr-2 font-bold" scope="col">Sayfa</th>
                    <th className="px-2 py-1 text-right font-bold" scope="col">Ziyaret</th>
                    <th className="px-2 py-1 text-right font-bold" scope="col">Kişi</th>
                    <th className="py-1 pl-2 text-right font-bold" scope="col">Girişli</th>
                  </tr>
                </thead>
                <tbody>
                  {veri.sayfalar.map((s) => (
                    <tr key={s.yol} className="border-t border-slate-100">
                      <td className="max-w-[16rem] truncate py-1.5 pr-2 font-mono text-[11px] text-slate-700" title={s.yol}>
                        {s.yol}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{sayi(s.ziyaret)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{sayi(s.tekil)}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-slate-600">{sayi(s.girisli)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Sayfa dönüşüm oranı</h3>
            <span className="text-[10px] text-slate-400">son 30 gün</span>
          </div>
          {veri.sayfaDonusum.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Kayıt yok</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-1 pr-2 font-bold" scope="col">Sayfa</th>
                    <th className="px-2 py-1 text-right font-bold" scope="col">Ziyaret</th>
                    <th className="px-2 py-1 text-right font-bold" scope="col">Girişli</th>
                    <th className="py-1 pl-2 text-right font-bold" scope="col">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {veri.sayfaDonusum.map((s) => (
                    <tr key={s.yol} className="border-t border-slate-100">
                      <td className="max-w-[16rem] truncate py-1.5 pr-2 font-mono text-[11px] text-slate-700" title={s.yol}>
                        {s.yol}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{sayi(s.ziyaret)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{sayi(s.girisli)}</td>
                      <td className="py-1.5 pl-2 text-right font-bold tabular-nums text-teal-700">
                        {yuzde(s.donusumOrani)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Giriş kaynağı</h3>
            <span className="text-[10px] text-slate-400">son 30 gün</span>
          </div>
          {veri.kaynaklar.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Giriş kaydı yok</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {veri.kaynaklar.map((k) => {
                const toplam = Math.max(1, veri.kaynaklar.reduce((t, x) => t + x.adet, 0));
                return (
                  <li key={k.etiket}>
                    <div className="flex items-baseline gap-2 text-xs text-slate-700">
                      <span className="flex-1">{k.etiket}</span>
                      <span className="text-[10px] text-slate-400">{yuzde(k.adet / toplam)}</span>
                      <b className="tabular-nums text-slate-900">{sayi(k.adet)}</b>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800"
                        style={{ width: `${Math.max(2, (k.adet / Math.max(...veri.kaynaklar.map((x) => x.adet))) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            En son giriş ülkesi:{" "}
            <b className="text-slate-800">
              {veri.sonUlke.ulke ? `${bayrak(veri.sonUlke.ulke)} ${ulkeAdi(veri.sonUlke.ulke)}` : "Bilinmiyor"}
            </b>
            {veri.sonUlke.email ? (
              <>
                {" "}· {veri.sonUlke.email}
                {veri.sonUlke.zaman ? ` · ${saatZaman(veri.sonUlke.zaman)}` : ""}
              </>
            ) : null}
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Cohort analizi</h3>
            <span className="text-[10px] text-slate-400">Haftalık geri dönüş · son 8 hafta</span>
          </div>
          {veri.cohort.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Kayıt yok</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2 font-bold" scope="col">Hafta</th>
                    <th className="px-2 py-2 text-right font-bold" scope="col">Yeni</th>
                    <th className="px-2 py-2 text-right font-bold" scope="col">H1</th>
                    <th className="px-2 py-2 text-right font-bold" scope="col">H2</th>
                    <th className="px-2 py-2 text-right font-bold" scope="col">H3</th>
                    <th className="px-2 py-2 text-right font-bold" scope="col">H4</th>
                  </tr>
                </thead>
                <tbody>
                  {veri.cohort.map((c) => (
                    <tr key={c.hafta} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-xs text-slate-700">{c.hafta}</td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{sayi(c.yeniKisi)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {c.yeniKisi > 0 ? yuzde(c.hafta1 / c.yeniKisi) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {c.yeniKisi > 0 ? yuzde(c.hafta2 / c.yeniKisi) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {c.yeniKisi > 0 ? yuzde(c.hafta3 / c.yeniKisi) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {c.yeniKisi > 0 ? yuzde(c.hafta4 / c.yeniKisi) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-400">H1-H4: o hafta kayıt olanların sonraki haftalarda geri dönüş oranı</p>
        </section>
      </div>
    </div>
  );
}

function CanliSekmesi({
  veri,
  akis,
  ara,
  setAra,
  olayFiltre,
  setOlayFiltre,
  simdi,
}: {
  veri: Veri;
  akis: Olay[];
  ara: string;
  setAra: (v: string) => void;
  olayFiltre: OlayFiltre;
  setOlayFiltre: (v: OlayFiltre) => void;
  simdi: number;
}) {
  const olaylar: { id: OlayFiltre; ad: string }[] = [
    { id: "hepsi", ad: "Hepsi" },
    { id: "ziyaret", ad: "Sayfa" },
    { id: "giris", ad: "Giriş" },
  ];
  const kolonSayisi = veri.ipKolonu ? 7 : 6;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-bold text-slate-900">Canlı hareket akışı</p>
          <p className="text-[11px] text-slate-500">
            Son {veri.sonOlaylar.length} olaydan {akis.length} kayıt · sayfa açılışları ve doğrulanmış girişler
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5" role="group" aria-label="Olay türü">
          {olaylar.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOlayFiltre(o.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${olayFiltre === o.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              {o.ad}
            </button>
          ))}
        </div>
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="e-posta / IP / sayfa ara"
          className="w-52 rounded-full border border-slate-300 px-3 py-1 text-xs outline-none focus:border-teal-600"
        />
      </div>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Canlı hareket akışı</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 font-bold" scope="col">Zaman</th>
              <th className="px-4 py-2 font-bold" scope="col">Olay</th>
              <th className="px-4 py-2 font-bold" scope="col">Kişi</th>
              <th className="px-4 py-2 font-bold" scope="col">Sayfa</th>
              <th className="px-4 py-2 font-bold" scope="col">Ülke</th>
              {veri.ipKolonu ? <th className="px-4 py-2 font-bold" scope="col">IP</th> : null}
              <th className="px-4 py-2 font-bold" scope="col">Cihaz</th>
            </tr>
          </thead>
          <tbody>
            {akis.map((o, i) => {
              const yeni = Date.parse(o.olusturma) > simdi - 2 * 60 * 1000;
              return (
                <tr
                  key={`${o.olusturma}:${o.email ?? "a"}:${i}`}
                  className={`border-t border-slate-100 ${yeni ? "bg-teal-50/40" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-slate-600" title={tamZaman(o.olusturma)}>
                    <span className="font-semibold text-slate-800">{gecenSure(o.olusturma, simdi)}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">{saatZaman(o.olusturma)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.olay === "giris"
                        ? "bg-slate-900 text-white"
                        : "bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                        }`}
                    >
                      {o.olay === "giris" ? kaynakYaz(o.kaynak) : "Sayfa"}
                    </span>
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-1.5 text-xs" title={o.email ?? "anonim"}>
                    {o.email || <span className="text-slate-400">anonim</span>}
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-1.5 text-xs text-slate-600" title={o.yol}>
                    {o.yol || "/"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs" title={o.ulke ? ulkeAdi(o.ulke) : ""}>
                    {o.ulke ? `${bayrak(o.ulke)} ${o.ulke}` : "?"}
                  </td>
                  {veri.ipKolonu ? (
                    <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-slate-600">
                      {o.ip || "—"}
                    </td>
                  ) : null}
                  <td className="max-w-[13rem] truncate px-4 py-1.5 text-xs text-slate-600" title={o.cihaz}>
                    {cihazEtiketi(o.cihaz)}
                  </td>
                </tr>
              );
            })}
            {akis.length === 0 ? (
              <tr>
                <td colSpan={kolonSayisi} className="px-4 py-8 text-center text-sm text-slate-400">
                  {ara || olayFiltre !== "hepsi" ? "Filtreye uyan olay yok" : "Henüz kayıt yok"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
        İlk 2 dakikadaki hareketler açık teal renkle işaretlenir. Liste {veri.sonOlaylar.length} olayla sınırlıdır.
      </p>
    </div>
  );
}

function KisilerSekmesi({
  veri,
  kisiler,
  kisiAra,
  setKisiAra,
  kisiSirala,
  setKisiSirala,
  kisiYon,
  setKisiYon,
}: {
  veri: Veri;
  kisiler: Kisi[];
  kisiAra: string;
  setKisiAra: (v: string) => void;
  kisiSirala: KisiSirala;
  setKisiSirala: (v: KisiSirala) => void;
  kisiYon: 1 | -1;
  setKisiYon: (v: 1 | -1) => void;
}) {
  function sirala(anahtar: KisiSirala) {
    if (anahtar === kisiSirala) {
      setKisiYon((kisiYon * -1) as 1 | -1);
      return;
    }
    setKisiSirala(anahtar);
    setKisiYon(anahtar === "email" ? 1 : -1);
  }

  function ok(anahtar: KisiSirala): string {
    if (anahtar !== kisiSirala) return "↕";
    return kisiYon === 1 ? "↑" : "↓";
  }

  const toplamGiris = veri.kullaniciDetay.reduce((t, k) => t + k.giris, 0);
  const toplamSayfa = veri.kullaniciDetay.reduce((t, k) => t + k.sayfa, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi etiket="Kayıtlı kişi" deger={sayi(veri.devamlilik.kisi)} alt="son 30 günde e-postası bilinen" />
        <Kpi etiket="Toplam giriş" deger={sayi(toplamGiris)} alt="son 30 gün" />
        <Kpi etiket="Toplam sayfa" deger={sayi(toplamSayfa)} alt="son 30 gün" />
        <Kpi
          etiket="Tekrar gelen"
          deger={sayi(veri.devamlilik.cokGun)}
          alt={`${sayi(veri.devamlilik.tekGun)} kişi tek gün geldi`}
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="mr-auto">
            <p className="text-sm font-bold text-slate-900">Kişiler · son 30 gün</p>
            <p className="text-[11px] text-slate-500">
              Giriş + sayfa hareketi · {kisiler.length} / {veri.kullaniciDetay.length} kişi
            </p>
          </div>
          <input
            value={kisiAra}
            onChange={(e) => setKisiAra(e.target.value)}
            placeholder="e-posta / IP / ülke ara"
            className="w-56 rounded-full border border-slate-300 px-3 py-1 text-xs outline-none focus:border-teal-600"
          />
        </div>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Kişi bazında hareket özeti</caption>
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 font-bold" scope="col">
                  <button type="button" onClick={() => sirala("email")} className="hover:text-slate-800">
                    Kişi {ok("email")}
                  </button>
                </th>
                <th className="px-4 py-2 text-right font-bold" scope="col">
                  <button type="button" onClick={() => sirala("giris")} className="hover:text-slate-800">
                    Giriş {ok("giris")}
                  </button>
                </th>
                <th className="px-4 py-2 text-right font-bold" scope="col">
                  <button type="button" onClick={() => sirala("sayfa")} className="hover:text-slate-800">
                    Sayfa {ok("sayfa")}
                  </button>
                </th>
                <th className="px-4 py-2 font-bold" scope="col">İlk görülme</th>
                <th className="px-4 py-2 font-bold" scope="col">
                  <button type="button" onClick={() => sirala("son")} className="hover:text-slate-800">
                    Son görülme {ok("son")}
                  </button>
                </th>
                <th className="px-4 py-2 font-bold" scope="col">Ülke</th>
                {veri.ipKolonu ? <th className="px-4 py-2 font-bold" scope="col">IP</th> : null}
                <th className="px-4 py-2 font-bold" scope="col">Cihaz</th>
                <th className="px-4 py-2 font-bold" scope="col">Son sayfa</th>
              </tr>
            </thead>
            <tbody>
              {kisiler.map((k) => (
                <tr key={k.email} className="border-t border-slate-100">
                  <td className="max-w-[15rem] truncate px-4 py-1.5 text-xs font-semibold text-slate-800" title={k.email}>
                    {k.email}
                  </td>
                  <td className="px-4 py-1.5 text-right font-bold tabular-nums">{sayi(k.giris)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{sayi(k.sayfa)}</td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-slate-600" title={tamZaman(k.ilk)}>
                    {saatZaman(k.ilk)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs font-semibold text-slate-800" title={tamZaman(k.son)}>
                    {saatZaman(k.son)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs" title={k.ulke ? ulkeAdi(k.ulke) : ""}>
                    {k.ulke ? `${bayrak(k.ulke)} ${k.ulke}` : "?"}
                  </td>
                  {veri.ipKolonu ? (
                    <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-slate-600">
                      {k.ip || "—"}
                    </td>
                  ) : null}
                  <td className="max-w-[13rem] truncate px-4 py-1.5 text-xs text-slate-600" title={k.cihaz}>
                    {cihazEtiketi(k.cihaz)}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-1.5 text-xs text-slate-600" title={k.sonYol}>
                    {k.sonYol || "/"}
                  </td>
                </tr>
              ))}
              {kisiler.length === 0 ? (
                <tr>
                  <td colSpan={veri.ipKolonu ? 9 : 8} className="px-4 py-8 text-center text-sm text-slate-400">
                    {kisiAra ? "Aramaya uyan kişi yok" : "Son 30 günde e-postası bilinen hareket yok"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Bu ay kim kaç kez girmiş</p>
          <p className="text-[11px] text-slate-500">{veri.buAy} · yalnızca doğrulanmış oturumlar</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Bu ay kullanıcı giriş sayıları</caption>
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 font-bold" scope="col">E-posta</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Giriş</th>
                <th className="px-4 py-2 font-bold" scope="col">Son giriş</th>
                <th className="px-4 py-2 font-bold" scope="col">Ülke</th>
                <th className="px-4 py-2 font-bold" scope="col">Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {veri.kullanicilar.map((k) => (
                <tr key={k.email} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs font-semibold text-slate-800">{k.email}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums">{sayi(k.adet)}</td>
                  <td className="px-4 py-2 text-xs text-slate-600" title={tamZaman(k.sonGiris)}>
                    {saatZaman(k.sonGiris)}
                  </td>
                  <td className="px-4 py-2 text-xs" title={k.ulke ? ulkeAdi(k.ulke) : ""}>
                    {k.ulke ? `${bayrak(k.ulke)} ${k.ulke}` : "?"}
                  </td>
                  <td className="px-4 py-2 text-xs">{kaynakYaz(k.kaynak)}</td>
                </tr>
              ))}
              {veri.kullanicilar.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    Bu ay giriş kaydı yok
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GunlukSekmesi({
  veri,
  gunAraligi,
  setGunAraligi,
}: {
  veri: Veri;
  gunAraligi: number;
  setGunAraligi: (v: number) => void;
}) {
  const detay = useMemo(() => [...veri.gunDetay].reverse().slice(0, gunAraligi), [veri.gunDetay, gunAraligi]);
  const tablo = useMemo(() => [...veri.gunluk].reverse().slice(0, gunAraligi), [veri.gunluk, gunAraligi]);
  const toplam = useMemo(
    () =>
      tablo.reduce(
        (t, g) => ({
          ziyaret: t.ziyaret + g.ziyaret,
          giris: t.giris + g.giris,
          google: t.google + g.google,
          parola: t.parola + g.parola,
          kullanan: t.kullanan + g.kullanan,
        }),
        { ziyaret: 0, giris: 0, google: 0, parola: 0, kullanan: 0 },
      ),
    [tablo],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-slate-900">Günlük kırılım</p>
        <div className="flex items-center gap-1 rounded-full bg-white p-0.5 ring-1 ring-slate-300" role="group" aria-label="Gün aralığı">
          {[7, 14, 30].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGunAraligi(g)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${gunAraligi === g ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              {g} gün
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Her gün kim girmiş</p>
          <p className="text-[11px] text-slate-500">Gün bazında ziyaret + giren kişiler · son {gunAraligi} gün</p>
        </div>
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Gün bazında girişler</caption>
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 font-bold" scope="col">Gün</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Ziyaret</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Giriş</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Google</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Şifre</th>
                <th className="px-4 py-2 font-bold" scope="col">Girenler (e-posta × adet)</th>
              </tr>
            </thead>
            <tbody>
              {detay.map((g) => (
                <tr key={g.gun} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-slate-800">{gunYaz(g.gun)}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums">{sayi(g.ziyaret)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{sayi(g.giris)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{sayi(g.google)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{sayi(g.parola)}</td>
                  <td className="px-4 py-2">
                    {g.kisiler.length === 0 ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {g.kisiler.map((k) => (
                          <span
                            key={`${g.gun}:${k.email}`}
                            title={`${tamZaman(k.son)} · ${ulkeAdi(k.ulke)} · ${kaynakYaz(k.kaynak)}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                          >
                            {k.email}
                            <b className="text-slate-900">×{sayi(k.adet)}</b>
                            {k.ulke ? <span className="text-[10px] text-teal-700">{k.ulke}</span> : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {detay.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    Bu aralıkta kayıt yok
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Günlük tablo</p>
          <p className="text-[11px] text-slate-500">UTC+3 İstanbul · son {gunAraligi} gün</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Günlük ziyaret ve giriş tablosu</caption>
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 font-bold" scope="col">Gün</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Ziyaret</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Giriş</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Google</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Şifre</th>
                <th className="px-4 py-2 text-right font-bold" scope="col">Kullanan</th>
              </tr>
            </thead>
            <tbody>
              {tablo.map((g) => (
                <tr key={g.gun} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-1.5 text-slate-800">{gunYaz(g.gun)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{sayi(g.ziyaret)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{sayi(g.giris)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{sayi(g.google)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{sayi(g.parola)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{sayi(g.kullanan)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td className="px-4 py-2 text-slate-800">Toplam</td>
                <td className="px-4 py-2 text-right tabular-nums">{sayi(toplam.ziyaret)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{sayi(toplam.giris)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{sayi(toplam.google)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{sayi(toplam.parola)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{sayi(toplam.kullanan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvHucre(deger: string | number | null | undefined): string {
  const s = String(deger ?? "");
  // Excel formül enjeksiyonunu engelle.
  const guvenli = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guvenli.replace(/"/g, '""')}"`;
}

function csvSatir(...degerler: (string | number | null | undefined)[]): string {
  return degerler.map(csvHucre).join(";");
}

function csvIndir(veri: Veri) {
  const satirlar: string[] = [];
  satirlar.push(csvSatir("BÖLÜM", "DEĞER"));
  satirlar.push(csvSatir("Ay", veri.buAy));
  satirlar.push(csvSatir("Veri zamanı", tamZaman(veri.veriZamani)));
  satirlar.push(csvSatir("Veri modu", veri.mod));
  satirlar.push(csvSatir("Bu ay ziyaret", veri.ziyaretBuAy));
  satirlar.push(csvSatir("Bu ay giriş", veri.girisBuAy));
  satirlar.push(csvSatir("Bu ay kullanan kişi", veri.kullananBuAy));
  satirlar.push(csvSatir("Bu ay tekil ziyaretçi", veri.tekilZiyaretciBuAy));
  satirlar.push(csvSatir("Bu ay dönüşüm", yuzde(veri.donusumBuAy)));
  satirlar.push(csvSatir("Google girişi", veri.googleBuAy));
  satirlar.push(csvSatir("Şifreli giriş", veri.parolaBuAy));
  satirlar.push(csvSatir("Yeni kayıt", veri.kayitBuAy));
  satirlar.push("");

  satirlar.push(csvSatir("GÜN", "ZİYARET", "GİRİŞ", "GOOGLE", "ŞİFRE", "KULLANAN"));
  for (const g of veri.gunluk) {
    satirlar.push(csvSatir(g.gun, g.ziyaret, g.giris, g.google, g.parola, g.kullanan));
  }
  satirlar.push("");

  satirlar.push(csvSatir("GÜN", "KİŞİ", "GİRİŞ_ADEDİ", "ÜLKE", "KAYNAK", "SON"));
  for (const g of veri.gunDetay) {
    for (const k of g.kisiler) {
      satirlar.push(csvSatir(g.gun, k.email, k.adet, k.ulke, kaynakYaz(k.kaynak), tamZaman(k.son)));
    }
  }
  satirlar.push("");

  satirlar.push(csvSatir("KİŞİ", "GİRİŞ", "SAYFA", "İLK_GÖRÜLME", "SON_GÖRÜLME", "ÜLKE", "IP", "CİHAZ", "SON_SAYFA"));
  for (const k of veri.kullaniciDetay) {
    satirlar.push(
      csvSatir(k.email, k.giris, k.sayfa, tamZaman(k.ilk), tamZaman(k.son), k.ulke, k.ip, cihazEtiketi(k.cihaz), k.sonYol),
    );
  }
  satirlar.push("");

  satirlar.push(csvSatir("SAYFA", "ZİYARET", "TEKİL_KİŞİ", "GİRİŞLİ"));
  for (const s of veri.sayfalar) satirlar.push(csvSatir(s.yol, s.ziyaret, s.tekil, s.girisli));
  satirlar.push("");

  satirlar.push(csvSatir("ÜLKE", "HAREKET", "TEKİL_KİŞİ"));
  for (const u of veri.ulkeler) satirlar.push(csvSatir(u.ulke, u.adet, u.tekil));
  satirlar.push("");

  satirlar.push(csvSatir("SAAT", "ZİYARET", "GİRİŞ", "TEKİL"));
  for (const s of veri.saatlik) satirlar.push(csvSatir(`${s.gun} ${s.etiket}`, s.ziyaret, s.giris, s.tekil));
  satirlar.push("");

  satirlar.push(csvSatir("ZAMAN", "OLAY", "KİŞİ", "ÜLKE", "IP", "CİHAZ", "SAYFA"));
  for (const o of veri.sonOlaylar) {
    satirlar.push(
      csvSatir(tamZaman(o.olusturma), o.olay === "giris" ? kaynakYaz(o.kaynak) : "Sayfa", o.email || "anonim", o.ulke, o.ip, cihazEtiketi(o.cihaz), o.yol),
    );
  }

  const blob = new Blob(["\ufeff" + satirlar.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `admin-rapor-${new Date().toISOString().slice(0, 10)}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------------ */
/* Ana bileşen                                                         */
/* ------------------------------------------------------------------ */

export default function AdminPanel() {
  const [sifre, setSifre] = useState("");
  const [oturum, setOturum] = useState(false);
  const [giriliyor, setGiriliyor] = useState(false);
  const [girisHata, setGirisHata] = useState<string | null>(null);
  const [veri, setVeri] = useState<Veri | null>(null);
  const [veriHata, setVeriHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonBasarili, setSonBasarili] = useState<Date | null>(null);
  const [testMesaj, setTestMesaj] = useState<string | null>(null);
  const [sekme, setSekme] = useState<Sekme>("ozet");
  const [aralik, setAralik] = useState(60);
  const [ara, setAra] = useState("");
  const [olayFiltre, setOlayFiltre] = useState<OlayFiltre>("hepsi");
  const [kisiAra, setKisiAra] = useState("");
  const [kisiSirala, setKisiSirala] = useState<KisiSirala>("son");
  const [kisiYon, setKisiYon] = useState<1 | -1>(-1);
  const [gunAraligi, setGunAraligi] = useState(30);
  const [simdi, setSimdi] = useState(() => Date.now());
  const istekRef = useRef(false);

  const yukle = useCallback(async () => {
    if (istekRef.current) return;
    istekRef.current = true;
    setYukleniyor(true);
    try {
      const r = await fetch("/api/admin/veri", { cache: "no-store" });
      if (r.status === 401) {
        setOturum(false);
        setVeri(null);
        setVeriHata("");
        return;
      }
      const j = (await r.json()) as Veri & { hata?: string };
      if (!r.ok || !j.ok) {
        setVeriHata(j.hata || `Sunucu hatası (${r.status})`);
        return;
      }
      setVeri(j);
      setOturum(true);
      setVeriHata("");
      setSonBasarili(new Date());
    } catch {
      setVeriHata("Sunucuya ulaşılamadı. Bağlantını kontrol edip yenile.");
    } finally {
      istekRef.current = false;
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    // İlk yükleme: render sırasında değil, bir sonraki turda başlasın.
    const h = setTimeout(() => void yukle(), 0);
    return () => clearTimeout(h);
  }, [yukle]);

  // Oto yenileme: sekme görünürken çalışır, arka planda boşuna istek atmaz.
  useEffect(() => {
    if (!oturum || aralik <= 0) return;
    const i = setInterval(() => {
      if (document.visibilityState === "visible") void yukle();
    }, aralik * 1000);
    return () => clearInterval(i);
  }, [oturum, aralik, yukle]);

  useEffect(() => {
    function gorunurluk() {
      if (document.visibilityState === "visible" && oturum && aralik > 0) void yukle();
    }
    document.addEventListener("visibilitychange", gorunurluk);
    return () => document.removeEventListener("visibilitychange", gorunurluk);
  }, [oturum, aralik, yukle]);

  // "3 dk önce" gibi etiketleri taze tut.
  useEffect(() => {
    const i = setInterval(() => setSimdi(Date.now()), 15_000);
    return () => clearInterval(i);
  }, []);

  async function gir(e: React.FormEvent) {
    e.preventDefault();
    setGiriliyor(true);
    setGirisHata(null);
    try {
      const r = await fetch("/api/admin/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre }),
      });
      const j = (await r.json()) as { ok?: boolean; hata?: string; kalanDeneme?: number };
      // Şifre bellekte kalmasın: ister doğru ister yanlış, denemeden hemen sil.
      setSifre("");
      if (!r.ok || !j.ok) {
        const ek =
          typeof j.kalanDeneme === "number" && j.kalanDeneme > 0
            ? ` (${j.kalanDeneme} deneme hakkı)`
            : "";
        setGirisHata((j.hata || "Şifre yanlış.") + ek);
        return;
      }
      await yukle();
    } catch {
      setSifre("");
      setGirisHata("Bağlantı sorunu.");
    } finally {
      setGiriliyor(false);
    }
  }

  async function cikis() {
    try {
      await fetch("/api/admin/giris", { method: "DELETE" });
    } catch {
      /* çerez zaten sunucuda silinir */
    }
    setOturum(false);
    setVeri(null);
    setVeriHata("");
    setSekme("ozet");
  }

  /** Takip kaydı gerçekten yazılabiliyor mu? Hatayı aynen gösterir. */
  async function testEt() {
    setTestMesaj("Deneniyor…");
    try {
      const r = await fetch("/api/admin/test-takip", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; mod?: string; hata?: string };
      if (j.ok) {
        setTestMesaj(`Test kaydı yazıldı (${j.mod === "supabase" ? "Supabase" : "dosya"}). Veriler yenilendi.`);
        await yukle();
      } else {
        const ham = j.hata || "bilinmeyen hata";
        const ipucu = /Could not find the table|schema cache/i.test(ham)
          ? " → SQL'i Vercel'deki Supabase projesinde çalıştırıp ardından `notify pgrst, 'reload schema';` komutunu da çalıştır."
          : "";
        setTestMesaj(`Test kaydı BAŞARISIZ: ${ham}${ipucu}`);
      }
    } catch {
      setTestMesaj("Test kaydı BAŞARISIZ: bağlantı sorunu.");
    }
  }

  const akis = useMemo(() => {
    const q = ara.trim().toLowerCase();
    return (veri?.sonOlaylar ?? []).filter((o) => {
      if (olayFiltre !== "hepsi" && o.olay !== olayFiltre) return false;
      if (!q) return true;
      return `${o.email || "anonim"} ${o.ip} ${o.ulke} ${o.yol} ${cihazEtiketi(o.cihaz)} ${kaynakYaz(o.kaynak)}`
        .toLowerCase()
        .includes(q);
    });
  }, [veri, ara, olayFiltre]);

  const kisiler = useMemo(() => {
    const q = kisiAra.trim().toLowerCase();
    const liste = (veri?.kullaniciDetay ?? []).filter((k) => {
      if (!q) return true;
      return `${k.email} ${k.ip} ${k.ulke} ${k.sonYol} ${cihazEtiketi(k.cihaz)}`
        .toLowerCase()
        .includes(q);
    });
    return [...liste].sort((a, b) => {
      const f =
        kisiSirala === "email"
          ? a.email.localeCompare(b.email, "tr")
          : kisiSirala === "giris"
            ? a.giris - b.giris
            : kisiSirala === "sayfa"
              ? a.sayfa - b.sayfa
              : Date.parse(a.son) - Date.parse(b.son);
      return f * kisiYon;
    });
  }, [veri, kisiAra, kisiSirala, kisiYon]);

  if (!oturum) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <form onSubmit={gir} className="w-full max-w-xs rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <p className="text-center text-4xl">🔒</p>
          <h1 className="mt-2 text-center text-lg font-extrabold text-slate-900">Yönetici Paneli</h1>
          <p className="mt-1 text-center text-xs text-slate-500">Gizli şifreyle girilir. Oturum 8 saat açık kalır.</p>
          <input
            type="password"
            name="y-gizli"
            required
            autoFocus
            autoComplete="new-password"
            spellCheck={false}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="Şifre"
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          {girisHata ? <p className="mt-2 text-xs text-rose-700">{girisHata}</p> : null}
          {veriHata && !girisHata ? <p className="mt-2 text-xs text-rose-700">{veriHata}</p> : null}
          <button
            type="submit"
            disabled={giriliyor}
            className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {giriliyor ? "…" : "Giriş"}
          </button>
          <p className="mt-3 text-center text-[10px] text-slate-400">
            Üretimde ADMIN_PASSWORD tanımlı değilse giriş kapalıdır.
          </p>
        </form>
      </div>
    );
  }

  const uyarilar = veri?.uyarilar ?? (veri?.uyari ? [veri.uyari] : []);

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">Yönetici Paneli</h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${veriHata
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${veriHata ? "bg-rose-500" : yukleniyor ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                />
                {veriHata ? "Bağlantı sorunu" : yukleniyor ? "Yenileniyor" : "Canlı"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Bu ay: {veri?.buAy ?? "—"}
              {veri?.mod ? ` · ${veri.mod === "supabase" ? "Supabase" : "yerel dosya"}` : ""}
              {sonBasarili ? ` · son yenileme ${sonBasarili.toLocaleTimeString("tr-TR")}` : ""}
              {veri?.ozet.sonOlayZamani ? ` · son hareket ${gecenSure(veri.ozet.sonOlayZamani, simdi)}` : ""}
            </p>
            {veri?.projeRef ? (
              <p className="text-[11px] text-slate-400">
                Supabase projesi: <b className="font-mono text-slate-600">{veri.projeRef}</b> · taranan olay:{" "}
                {sayi(veri.olaySayisi)} / bu ay {sayi(veri.buAyOlaySayisi)}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300">
            <span className="text-slate-500">Oto</span>
            <select
              value={aralik}
              onChange={(e) => setAralik(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-800 outline-none"
              aria-label="Otomatik yenileme aralığı"
            >
              <option value={0}>Kapalı</option>
              <option value={30}>30 sn</option>
              <option value={60}>60 sn</option>
              <option value={300}>5 dk</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => veri && csvIndir(veri)}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            CSV indir
          </button>
          <button
            type="button"
            onClick={() => void yukle()}
            disabled={yukleniyor}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {yukleniyor ? "Yenileniyor…" : "Yenile"}
          </button>
          <button
            type="button"
            onClick={() => void testEt()}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-teal-800 ring-1 ring-teal-300 hover:bg-teal-50"
          >
            Test kaydı
          </button>
          <button
            type="button"
            onClick={() => void cikis()}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
          >
            Çıkış
          </button>
        </header>

        {testMesaj ? (
          <p className="rounded-2xl bg-teal-50 px-4 py-2 text-xs text-teal-900 ring-1 ring-teal-200">{testMesaj}</p>
        ) : null}

        {veriHata ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-900 ring-1 ring-rose-200">
            <span className="mr-auto">{veriHata}</span>
            <button
              type="button"
              onClick={() => void yukle()}
              className="rounded-full bg-white px-3 py-1 font-bold ring-1 ring-rose-200"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}

        {uyarilar.map((u, i) => (
          <p key={`${i}:${u.slice(0, 20)}`} className="rounded-2xl bg-amber-50 px-4 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            {u}
          </p>
        ))}

        {yukleniyor && !veri ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : veri ? (
          <>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Yönetici panelleri">
              <SekmeDugmesi aktif={sekme === "ozet"} ad="Özet" onClick={() => setSekme("ozet")} />
              <SekmeDugmesi
                aktif={sekme === "canli"}
                ad="Canlı akış"
                rozet={veri.sonOlaylar.length}
                onClick={() => setSekme("canli")}
              />
              <SekmeDugmesi
                aktif={sekme === "kisiler"}
                ad="Kişiler"
                rozet={veri.kullaniciDetay.length}
                onClick={() => setSekme("kisiler")}
              />
              <SekmeDugmesi aktif={sekme === "gunluk"} ad="Günlük" rozet={30} onClick={() => setSekme("gunluk")} />
            </div>

            <div
              role="tabpanel"
              aria-label={
                sekme === "ozet" ? "Özet" : sekme === "canli" ? "Canlı akış" : sekme === "kisiler" ? "Kişiler" : "Günlük"
              }
            >
              {sekme === "ozet" ? <OzetSekmesi veri={veri} /> : null}
              {sekme === "canli" ? (
                <CanliSekmesi
                  veri={veri}
                  akis={akis}
                  ara={ara}
                  setAra={setAra}
                  olayFiltre={olayFiltre}
                  setOlayFiltre={setOlayFiltre}
                  simdi={simdi}
                />
              ) : null}
              {sekme === "kisiler" ? (
                <KisilerSekmesi
                  veri={veri}
                  kisiler={kisiler}
                  kisiAra={kisiAra}
                  setKisiAra={setKisiAra}
                  kisiSirala={kisiSirala}
                  setKisiSirala={setKisiSirala}
                  kisiYon={kisiYon}
                  setKisiYon={setKisiYon}
                />
              ) : null}
              {sekme === "gunluk" ? (
                <GunlukSekmesi veri={veri} gunAraligi={gunAraligi} setGunAraligi={setGunAraligi} />
              ) : null}
            </div>

            <p className="pb-6 text-center text-[11px] text-slate-400">
              Veriler sayfa açılışları + doğrulanmış oturum açmalardan toplanır. E-posta yalnızca Supabase jetonu
              doğrulandığında yazılır. IP ve cihaz bilgisi kişiyi ayırt etmek için tutulur; yalnızca yönetici görebilir.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Veri açılamadı — yenile.</p>
        )}
      </div>
    </div>
  );
}
