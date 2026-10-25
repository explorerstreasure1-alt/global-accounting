/**
 * Site takibi: ziyaret + giriş olayları.
 * İki mod:
 *  - Supabase açık + SUPABASE_SERVICE_ROLE_KEY varsa → `site_takip` tablosu (service_role, RLS bypass)
 *  - Yoksa → yerel dosya `site-takip.jsonl` (getDataDir altında, satır satır JSON)
 *
 * Kayıt alanları: zaman, olay, kaynak, e-posta, ülke, sayfa, IP, cihaz (tarayıcı).
 * E-posta asla istemciden körü körüne alınmaz; /api/admin/track tarafında
 * Supabase token'ı doğrulanır (bkz. lib/kimlik.ts).
 *
 * Yönetici paneli (/admin) bu veriyi `/api/admin/veri` üzerinden topluca görür.
 */
import { promises as fs } from "fs";
import path from "path";
import { pool } from "@/db";
import { saasConfigured } from "./tenant";
import { getDataDir } from "./file-store";
import { cihazBilgisi, cihazTuru, isletimEtiketi, tarayiciEtiketi } from "./cihaz";

export type TakipOlayi = {
  olusturma: string; // ISO
  olay: "ziyaret" | "giris";
  kaynak: string; // "" | "google" | "parola" | "kayit"
  email: string | null;
  ulke: string;
  yol: string;
  ip?: string;
  cihaz?: string; // ham user-agent (kısaltılmış)
  referer?: string; // traffic source (optional)
};

/** Sayfa başına satır: PostgREST varsayılan 1000 satır sınırını aşmak için. */
const SAYFA_BOYU = 1000;
/** Tek panel isteğinde taranacak en fazla olay (bellek/performans güvenliği). */
const EN_FAZLA_SATIR = 20000;

let ipKolonuVar: boolean | null = null; // null = henüz denenmedi
let sonKirpildi = false;
let sonOkumaHatasi = "";

// Intl formatter'ları her olayda yeniden kurmak 20.000 satırda pahalıya gelir.
const IST_GUN_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const IST_SAAT_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Gün etiketi (Europe/Istanbul): "2026-10-22" */
export function gunEtiketi(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return IST_GUN_FMT.format(d);
}

/** Saat etiketi (Europe/Istanbul): "2026-10-22T14" */
export function saatEtiketi(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (!Number.isFinite(d.getTime())) return "";
  const p = IST_SAAT_FMT.formatToParts(d);
  const al = (tur: string) => p.find((x) => x.type === tur)?.value ?? "";
  return `${al("year")}-${al("month")}-${al("day")}T${al("hour")}`;
}

/** ISO zamanı sayıya çevir (geçersizse 0). Metin karşılaştırması yerine kullanılır. */
function zamanMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Son panel okumasında oluşan hata (boşsa sorun yok). */
export function takipOkumaHatasi(): string {
  return sonOkumaHatasi;
}

/** Son okuma 20.000 satır sınırına takıldı mı? (panel uyarı gösterir) */
export function takipKirpildiMi(): boolean {
  return sonKirpildi;
}

/** Supabase tablosunda ip/cihaz kolonları var mı? (false → SQL migration eksik) */
export function takipKolonDurumu(): boolean | null {
  return ipKolonuVar;
}

/** JWT / yeni Supabase anahtarından rolü çöz (imza doğrulamadan). */
function anahtarRolu(anahtar: string): string {
  if (anahtar.startsWith("sb_secret_")) return "service_role";
  if (anahtar.startsWith("sb_publishable_")) return "anon";
  const parcalar = anahtar.split(".");
  if (parcalar.length === 3) {
    try {
      const govde = Buffer.from(parcalar[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      const j = JSON.parse(govde) as { role?: string };
      return String(j.role || "");
    } catch {
      return "";
    }
  }
  return "";
}

/** Servis anahtarı tanımlı ama yanlış türde mi? (ör. anon anahtarı yazılmış) */
export function servisAnahtariSorunu(): string {
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!anahtar) return "SUPABASE_SERVICE_ROLE_KEY tanımlı değil — Vercel env'ine Supabase service_role (secret) anahtarını ekle.";
  const rol = anahtarRolu(anahtar);
  if (rol && rol !== "service_role") {
    return `SUPABASE_SERVICE_ROLE_KEY yanlış: bu bir "${rol}" anahtarı. Supabase → Settings → API (Keys) → service_role / secret anahtarını kullan.`;
  }
  return "";
}

/** Sadece sunucu: service-role anahtarı var mı? */
export function takipServisiAcik(): boolean {
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    anahtar &&
    anahtarRolu(anahtar) === "service_role" &&
    saasConfigured(),
  );
}

let takipTablosuDenendi = false;

/**
 * `site_takip` tablosu yoksa otomatik kur (DATABASE_URL varsa).
 * Supabase projesinde tablo eksik olduğunda yönetici paneli boş kalıyordu;
 * bu fonksiyon ilk istekte idempotent olarak tabloyu + indeksleri oluşturur.
 * ip/cihaz kolonları da sonradan eklenir (eski tablolar bozulmaz).
 */
async function takipTablosunuKur(): Promise<void> {
  if (takipTablosuDenendi || !pool) return;
  takipTablosuDenendi = true;
  try {
    await pool.query(`
      create table if not exists site_takip (
        id bigint generated always as identity primary key,
        olusturma timestamptz not null default now(),
        olay varchar(20) not null default 'ziyaret',
        kaynak varchar(20) not null default '',
        email varchar(200),
        ulke varchar(10) not null default '',
        yol varchar(200) not null default '',
        ip varchar(64) not null default '',
        cihaz varchar(300) not null default '',
        referer varchar(500) not null default ''
      );
      alter table site_takip add column if not exists ip varchar(64) not null default '';
      alter table site_takip add column if not exists cihaz varchar(300) not null default '';
      alter table site_takip add column if not exists referer varchar(500) not null default '';
      create index if not exists site_takip_olusturma_idx on site_takip(olusturma);
      create index if not exists site_takip_email_idx on site_takip(email);
      create index if not exists site_takip_ip_idx on site_takip(ip);
      create index if not exists site_takip_olay_olusturma_idx on site_takip(olay, olusturma desc);
      create index if not exists site_takip_email_olusturma_idx on site_takip(email, olusturma desc);
      alter table site_takip enable row level security;
    `);
  } catch {
    // DB yok / yetki yok: panel uyarı gösterir, istekler bozulmaz.
    return;
  }
  // Düz Postgres'te bu roller olmayabilir; tablo yine de kurulmuş olur.
  await pool
    .query(`
      grant insert on public.site_takip to anon, authenticated;
      grant usage, select on sequence public.site_takip_id_seq to anon, authenticated, service_role;
      grant all on public.site_takip to service_role;
    `)
    .catch(() => undefined);
}

async function supaVe() {
  const { createServiceClient } = await import("./supabase/server");
  return createServiceClient();
}

/** Eski tabloda ip/cihaz kolonu yok mu? (hata mesajından anla) */
function ipKolonuEksik(mesaj: string): boolean {
  return /schema cache|column|does not exist/i.test(mesaj) && /ip|cihaz/i.test(mesaj);
}

/** Olay kaydet (sunucu tarafı). Hata atarsa çağıran sessiz kalıp kalmamayı seçer. */
export async function takipKaydet(olay: Omit<TakipOlayi, "olusturma">): Promise<void> {
  await takipTablosunuKur();
  const satir: TakipOlayi = { olusturma: new Date().toISOString(), ...olay };
  const temel = {
    olay: satir.olay,
    kaynak: satir.kaynak,
    email: satir.email,
    ulke: satir.ulke,
    yol: (satir.yol || "").slice(0, 200),
  };
  const ek = {
    ip: (satir.ip || "").slice(0, 64),
    cihaz: (satir.cihaz || "").slice(0, 300),
  };
  if (takipServisiAcik()) {
    const supa = await supaVe();
    if (ipKolonuVar !== false) {
      const { error } = await supa.from("site_takip").insert({ ...temel, ...ek });
      if (!error) {
        ipKolonuVar = true;
        return;
      }
      // Eski tabloda ip/cihaz yoksa kayıt kaybolmasın: temel alanlarla tekrar dene.
      if (!ipKolonuEksik(error.message)) throw new Error(error.message);
      ipKolonuVar = false;
    }
    const { error } = await supa.from("site_takip").insert(temel);
    if (error) throw new Error(error.message);
    return;
  }
  const dosya = path.join(getDataDir(), "site-takip.jsonl");
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  await fs.appendFile(dosya, JSON.stringify({ ...satir, ...ek }) + "\n", "utf8");
}

/** Yönetici paneli için teşhis: Supabase'ten okuma gerçekten çalışıyor mu? */
export async function takipTanisi(): Promise<string> {
  if (!takipServisiAcik()) return "";
  try {
    const supa = await supaVe();
    // head/count yerine gerçek satır okuması: eksik tabloyu güvenilir şekilde yakalar.
    const { error } = await supa.from("site_takip").select("id").limit(1);
    if (error) return `Supabase okuma hatası: ${error.message}`;
    return "";
  } catch (e) {
    return `Supabase bağlantı hatası: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function satiraCevir(r: Record<string, unknown>): TakipOlayi {
  return {
    olusturma: String(r.olusturma ?? ""),
    olay: r.olay === "giris" ? "giris" : "ziyaret",
    kaynak: String(r.kaynak ?? ""),
    email: r.email ? String(r.email).toLowerCase() : null,
    ulke: String(r.ulke ?? ""),
    yol: String(r.yol ?? ""),
    ip: String(r.ip ?? ""),
    cihaz: String(r.cihaz ?? ""),
    referer: String(r.referer ?? ""),
  };
}

/**
 * Supabase'ten olayları SAYFA SAYFA çeker.
 * `.limit(60000)` PostgREST'in 1000 satır sınırına takılıp aylık toplamları
 * sessizce eksiltiyordu; artık 1000'lik dilimlerle ilerliyor.
 */
async function supaOlaylar(sinir: string): Promise<TakipOlayi[]> {
  const supa = await supaVe();
  const liste: TakipOlayi[] = [];
  const sinirMs = zamanMs(sinir);
  const kolonlar = () =>
    ipKolonuVar === false
      ? "olusturma, olay, kaynak, email, ulke, yol, referer"
      : "olusturma, olay, kaynak, email, ulke, yol, ip, cihaz, referer";

  for (let bas = 0; bas < EN_FAZLA_SATIR; bas += SAYFA_BOYU) {
    const sorgula = () =>
      supa
        .from("site_takip")
        .select(kolonlar())
        .order("olusturma", { ascending: false })
        .range(bas, bas + SAYFA_BOYU - 1);

    let sonuc = await sorgula();
    if (sonuc.error && ipKolonuVar !== false && ipKolonuEksik(sonuc.error.message)) {
      ipKolonuVar = false;
      sonuc = await sorgula();
    }
    if (sonuc.error) {
      sonOkumaHatasi = sonuc.error.message || "Supabase okuma hatası";
      break;
    }
    if (ipKolonuVar === null) ipKolonuVar = true;

    const veri = (sonuc.data ?? []) as unknown as Record<string, unknown>[];
    for (const r of veri) {
      const o = satiraCevir(r);
      if (zamanMs(o.olusturma) >= sinirMs) liste.push(o);
    }
    if (veri.length < SAYFA_BOYU) break;
    const enEski = String(veri[veri.length - 1]?.olusturma ?? "");
    if (enEski && zamanMs(enEski) < sinirMs) break;
    if (bas + SAYFA_BOYU >= EN_FAZLA_SATIR) sonKirpildi = true;
  }
  // Panelde "en son" hesapları kolay olsun diye eskiden yeniye sırala.
  return liste.sort((a, b) => zamanMs(a.olusturma) - zamanMs(b.olusturma));
}

/** Ham olaylar (son N gün), eskiden yeniye sıralı. */
export async function takipHam(gun: number): Promise<TakipOlayi[]> {
  await takipTablosunuKur();
  sonKirpildi = false;
  sonOkumaHatasi = "";
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000).toISOString();
  const sinirMs = zamanMs(sinir);
  if (takipServisiAcik()) return supaOlaylar(sinir);
  try {
    const dosya = path.join(getDataDir(), "site-takip.jsonl");
    const icerik = await fs.readFile(dosya, "utf8");
    const satirlar = icerik.trim().split("\n").filter(Boolean);
    const liste: TakipOlayi[] = [];
    for (const s of satirlar) {
      try {
        const j = JSON.parse(s) as TakipOlayi;
        if (zamanMs(String(j.olusturma ?? "")) >= sinirMs) {
          liste.push(satiraCevir(j as unknown as Record<string, unknown>));
        }
      } catch {
        /* bozuk satırı yoksay */
      }
    }
    return liste.sort((a, b) => zamanMs(a.olusturma) - zamanMs(b.olusturma));
  } catch (e) {
    // Dosya henüz yoksa bu bir hata değildir; başka bir okuma sorunu varsa panele taşı.
    const kod = (e as NodeJS.ErrnoException)?.code;
    if (kod !== "ENOENT") {
      sonOkumaHatasi = e instanceof Error ? e.message : String(e);
    }
    return [];
  }
}

/** Yönetici panelindeki "Test kaydı" düğmesi: gerçek hatayı yüzeye çıkarır. */
export async function takipTest(): Promise<{ ok: boolean; mod: "supabase" | "dosya"; hata?: string }> {
  const mod = takipServisiAcik() ? "supabase" : "dosya";
  try {
    await takipKaydet({ olay: "ziyaret", kaynak: "", email: null, ulke: "", yol: "/admin-test", ip: "", cihaz: "" });
    return { ok: true, mod };
  } catch (e) {
    return { ok: false, mod, hata: e instanceof Error ? e.message : String(e) };
  }
}

/** İçinde bulunulan ayın ilk günü (Europe/Istanbul): "2026-10-01" */
export function ayBasiEtiketi(): string {
  return `${gunEtiketi(new Date().toISOString()).slice(0, 8)}01`;
}

/** Bugünden geriye N günün ilk günü (Europe/Istanbul). */
export function gunSiniri(gunSayisi: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  return fmt.format(new Date(Date.now() - (gunSayisi - 1) * 24 * 60 * 60 * 1000));
}

export type GunSatiri = {
  gun: string;
  ziyaret: number;
  giris: number;
  google: number;
  parola: number;
  kullanan: number; // farklı e-posta
};

export function guneBol(olaylar: TakipOlayi[], gunSayisi: number): GunSatiri[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const gunler: string[] = [];
  for (let i = gunSayisi - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    gunler.push(fmt.format(d));
  }
  const harita = new Map<string, { ziyaret: number; giris: number; google: number; parola: number; mail: Set<string> }>();
  for (const g of gunler) harita.set(g, { ziyaret: 0, giris: 0, google: 0, parola: 0, mail: new Set() });
  for (const o of olaylar) {
    const g = gunEtiketi(o.olusturma);
    const k = harita.get(g);
    if (!k) continue;
    if (o.olay === "ziyaret") k.ziyaret++;
    else {
      k.giris++;
      if (o.kaynak === "google") k.google++;
      else if (o.kaynak === "parola") k.parola++;
      if (o.email) k.mail.add(o.email.toLowerCase());
    }
  }
  return gunler.map((gun) => {
    const k = harita.get(gun)!;
    return { gun, ziyaret: k.ziyaret, giris: k.giris, google: k.google, parola: k.parola, kullanan: k.mail.size };
  });
}

export type KullaniciSatiri = {
  email: string;
  adet: number; // bu ay kaç kez giriş
  sonGiris: string;
  ulke: string;
  kaynak: string;
};

/** Bu ayın kullanıcı tablosu: kim kaç kez girmiş, hangi ülkeden, en son ne zaman */
export function buAyKullanicilari(olaylar: TakipOlayi[]): KullaniciSatiri[] {
  const buAy = ayBasiEtiketi().slice(0, 7); // YYYY-MM
  const harita = new Map<string, KullaniciSatiri>();
  for (const o of olaylar) {
    if (o.olay !== "giris" || !o.email) continue;
    if (!gunEtiketi(o.olusturma).startsWith(buAy)) continue;
    const anahtar = o.email.toLowerCase();
    const mevcut = harita.get(anahtar);
    if (mevcut) {
      mevcut.adet++;
      if (zamanMs(o.olusturma) >= zamanMs(mevcut.sonGiris)) {
        mevcut.sonGiris = o.olusturma;
        if (o.ulke) mevcut.ulke = o.ulke;
        mevcut.kaynak = kaynakEtiketi(o.kaynak) || mevcut.kaynak;
      }
    } else {
      harita.set(anahtar, {
        email: anahtar,
        adet: 1,
        sonGiris: o.olusturma,
        ulke: o.ulke || "",
        kaynak: kaynakEtiketi(o.kaynak),
      });
    }
  }
  return [...harita.values()].sort((a, b) => b.adet - a.adet || zamanMs(b.sonGiris) - zamanMs(a.sonGiris));
}

/** Kaynak kodu → panel etiketi */
export function kaynakEtiketi(kaynak: string): string {
  if (kaynak === "google") return "google";
  if (kaynak === "parola") return "parola";
  if (kaynak === "kayit") return "kayit";
  return "";
}

export type UlkeSatiri = { ulke: string; adet: number; tekil: number };

/** Ülke dağılımı: hem hareket sayısı hem tekil kişi. */
export function ulkeDagilimi(olaylar: TakipOlayi[]): UlkeSatiri[] {
  const harita = new Map<string, { adet: number; kume: Set<string> }>();
  for (const o of olaylar) {
    if (!o.ulke) continue;
    const k = harita.get(o.ulke) ?? { adet: 0, kume: new Set<string>() };
    k.adet++;
    const kisi = o.email ? `e:${o.email.toLowerCase()}` : o.ip ? `ip:${o.ip}` : "";
    if (kisi) k.kume.add(kisi);
    harita.set(o.ulke, k);
  }
  return [...harita.entries()]
    .map(([ulke, k]) => ({ ulke, adet: k.adet, tekil: k.kume.size }))
    .sort((a, b) => b.adet - a.adet || b.tekil - a.tekil)
    .slice(0, 12);
}

/** En son GERÇEK girişin ülkesi (ziyaretler değil). Sıralamadan bağımsız. */
export function sonUlke(olaylar: TakipOlayi[]): { ulke: string; zaman: string; email: string } {
  let en: TakipOlayi | null = null;
  for (const o of olaylar) {
    if (o.olay !== "giris" || !o.ulke) continue;
    if (!en || zamanMs(o.olusturma) > zamanMs(en.olusturma)) en = o;
  }
  return en ? { ulke: en.ulke, zaman: en.olusturma, email: en.email || "" } : { ulke: "", zaman: "", email: "" };
}

export function distinctEpostalar(olaylar: TakipOlayi[]): { email: string; sonZaman: string; adet: number }[] {
  const harita = new Map<string, { email: string; sonZaman: string; adet: number }>();
  for (const o of olaylar) {
    if (!o.email) continue;
    const a = o.email.toLowerCase();
    const mevcut = harita.get(a);
    if (mevcut) {
      mevcut.adet++;
      if (zamanMs(o.olusturma) > zamanMs(mevcut.sonZaman)) mevcut.sonZaman = o.olusturma;
    } else {
      harita.set(a, { email: a, sonZaman: o.olusturma, adet: 1 });
    }
  }
  return [...harita.values()].sort((a, b) => zamanMs(b.sonZaman) - zamanMs(a.sonZaman));
}

export type GunKisi = {
  email: string;
  adet: number; // o gün kaç kez giriş
  ulke: string;
  kaynak: string;
  son: string;
};

export type GunDetaySatiri = {
  gun: string;
  ziyaret: number; // o gün açılan sayfa sayısı
  giris: number; // o gün toplam oturum
  google: number;
  parola: number;
  kisiler: GunKisi[]; // o gün girenler (e-posta bazında)
};

/** "Her gün kim girmiş": gün bazında ziyaret + giriş + kullanıcı kırılımı */
export function gunDetay(olaylar: TakipOlayi[], gunSayisi: number): GunDetaySatiri[] {
  const sonlar = guneBol(olaylar, gunSayisi); // ziyaret/giriş sayaçları hazır

  const harita = new Map<string, Map<string, GunKisi>>();
  for (const o of olaylar) {
    if (o.olay !== "giris" || !o.email) continue;
    const g = gunEtiketi(o.olusturma);
    let gunluk = harita.get(g);
    if (!gunluk) {
      gunluk = new Map();
      harita.set(g, gunluk);
    }
    const a = o.email.toLowerCase();
    const mevcut = gunluk.get(a);
    if (mevcut) {
      mevcut.adet++;
      if (zamanMs(o.olusturma) >= zamanMs(mevcut.son)) {
        mevcut.son = o.olusturma;
        if (o.ulke) mevcut.ulke = o.ulke;
        mevcut.kaynak = kaynakEtiketi(o.kaynak) || mevcut.kaynak;
      }
    } else {
      gunluk.set(a, {
        email: a,
        adet: 1,
        ulke: o.ulke || "",
        kaynak: kaynakEtiketi(o.kaynak),
        son: o.olusturma,
      });
    }
  }
  return sonlar.map((s) => ({
    gun: s.gun,
    ziyaret: s.ziyaret,
    giris: s.giris,
    google: s.google,
    parola: s.parola,
    kisiler: [...(harita.get(s.gun)?.values() ?? [])].sort((x, y) => (x.son < y.son ? 1 : -1)),
  }));
}

/** Bugünün satırı: günü değil, İstanbul gün etiketiyle bugüne süz. */
export function bugunku(olaylar: TakipOlayi[]): { ziyaret: number; giris: number } {
  const bugun = gunEtiketi(new Date().toISOString());
  let ziyaret = 0;
  let giris = 0;
  for (const o of olaylar) {
    if (gunEtiketi(o.olusturma) !== bugun) continue;
    if (o.olay === "ziyaret") ziyaret++;
    else giris++;
  }
  return { ziyaret, giris };
}

/**
 * Tekil kişi sayısı.
 * Öncelik e-posta: aynı ofis/NAT IP'sindeki iki kullanıcı tek kişi sayılmasın.
 * E-posta yoksa (anonim ziyaretçi) IP kullanılır.
 */
export function tekilKisi(olaylar: TakipOlayi[], sadeceOlay?: "ziyaret" | "giris"): number {
  const kume = new Set<string>();
  for (const o of olaylar) {
    if (sadeceOlay && o.olay !== sadeceOlay) continue;
    const anahtar = o.email
      ? `e:${o.email.toLowerCase()}`
      : o.ip
        ? `ip:${o.ip}`
        : "";
    if (anahtar) kume.add(anahtar);
  }
  return kume.size;
}

export type SonOlay = {
  olusturma: string;
  olay: "ziyaret" | "giris";
  kaynak: string;
  email: string | null;
  ulke: string;
  yol: string;
  ip: string;
  cihaz: string;
};

/** Panelin "canlı akış" tablosu: en yeni olaylar önce. */
export function sonOlaylar(olaylar: TakipOlayi[], adet = 150): SonOlay[] {
  return [...olaylar]
    .sort((a, b) => zamanMs(b.olusturma) - zamanMs(a.olusturma))
    .slice(0, adet)
    .map((o) => ({
      olusturma: o.olusturma,
      olay: o.olay,
      kaynak: kaynakEtiketi(o.kaynak),
      email: o.email,
      ulke: o.ulke,
      yol: o.yol,
      ip: o.ip || "",
      cihaz: o.cihaz || "",
    }));
}

export type KullaniciDetay = {
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

/**
 * E-posta bazında tam hareket özeti: kaç giriş, kaç sayfa, ilk/son görülme,
 * son ülke/IP/cihaz ve son açtığı sayfa. "Kim en ufak faaliyette bulundu"
 * sorusunun cevabı bu tablodan okunur (ziyaretler de oturum açmışsa e-postalıdır).
 */
export function kullaniciDetaylari(olaylar: TakipOlayi[]): KullaniciDetay[] {
  const harita = new Map<string, KullaniciDetay>();
  for (const o of olaylar) {
    if (!o.email) continue;
    const a = o.email.toLowerCase();
    let k = harita.get(a);
    if (!k) {
      k = {
        email: a,
        giris: 0,
        sayfa: 0,
        ilk: o.olusturma,
        son: o.olusturma,
        ulke: o.ulke || "",
        ip: o.ip || "",
        cihaz: o.cihaz || "",
        sonYol: o.yol || "",
        kaynak: "",
      };
      harita.set(a, k);
    }
    if (o.olay === "giris") {
      k.giris++;
      if (zamanMs(o.olusturma) >= zamanMs(k.son)) k.kaynak = kaynakEtiketi(o.kaynak) || k.kaynak;
    } else {
      k.sayfa++;
    }
    if (zamanMs(o.olusturma) < zamanMs(k.ilk)) k.ilk = o.olusturma;
    if (zamanMs(o.olusturma) >= zamanMs(k.son)) {
      k.son = o.olusturma;
      if (o.ulke) k.ulke = o.ulke;
      if (o.ip) k.ip = o.ip;
      if (o.cihaz) k.cihaz = o.cihaz;
      if (o.yol) k.sonYol = o.yol;
    }
  }
  return [...harita.values()].sort((a, b) => zamanMs(b.son) - zamanMs(a.son));
}

/* ------------------------------------------------------------------ */
/* Panel göstergeleri için ek kırılımlar                                */
/* ------------------------------------------------------------------ */

/** Bir olayı tekil kişiye bağlayan anahtar (önce e-posta, sonra IP). */
function kisiAnahtari(o: TakipOlayi): string {
  return o.email ? `e:${o.email.toLowerCase()}` : o.ip ? `ip:${o.ip}` : "";
}

export type SaatSatiri = {
  saat: string; // YYYY-MM-DDTHH (İstanbul)
  etiket: string; // "14:00"
  gun: string; // YYYY-MM-DD
  ziyaret: number;
  giris: number;
  tekil: number;
};

/** Son N saatin saatlik hareketi (varsayılan 24 saat). */
export function saatlikDagilim(olaylar: TakipOlayi[], saatSayisi = 24): SaatSatiri[] {
  const simdi = Date.now();
  const anahtarlar: string[] = [];
  for (let i = saatSayisi - 1; i >= 0; i--) {
    anahtarlar.push(saatEtiketi(new Date(simdi - i * 60 * 60 * 1000)));
  }
  const harita = new Map<string, { ziyaret: number; giris: number; kume: Set<string> }>();
  for (const k of anahtarlar) harita.set(k, { ziyaret: 0, giris: 0, kume: new Set() });
  for (const o of olaylar) {
    const k = harita.get(saatEtiketi(o.olusturma));
    if (!k) continue;
    if (o.olay === "ziyaret") k.ziyaret++;
    else k.giris++;
    const kisi = kisiAnahtari(o);
    if (kisi) k.kume.add(kisi);
  }
  return anahtarlar.map((saat) => {
    const k = harita.get(saat)!;
    return {
      saat,
      etiket: `${saat.slice(11, 13)}:00`,
      gun: saat.slice(0, 10),
      ziyaret: k.ziyaret,
      giris: k.giris,
      tekil: k.kume.size,
    };
  });
}

export type SayfaSatiri = { yol: string; ziyaret: number; girisli: number; tekil: number };

/** En çok açılan sayfalar (son 30 gün). */
export function sayfaDagilimi(olaylar: TakipOlayi[], adet = 12): SayfaSatiri[] {
  const harita = new Map<string, { ziyaret: number; girisli: number; kume: Set<string> }>();
  for (const o of olaylar) {
    if (o.olay !== "ziyaret") continue;
    const yol = (o.yol || "/").split("?")[0].split("#")[0].slice(0, 200) || "/";
    const k = harita.get(yol) ?? { ziyaret: 0, girisli: 0, kume: new Set<string>() };
    k.ziyaret++;
    if (o.email) k.girisli++;
    const kisi = kisiAnahtari(o);
    if (kisi) k.kume.add(kisi);
    harita.set(yol, k);
  }
  return [...harita.entries()]
    .map(([yol, k]) => ({ yol, ziyaret: k.ziyaret, girisli: k.girisli, tekil: k.kume.size }))
    .sort((a, b) => b.ziyaret - a.ziyaret || b.tekil - a.tekil)
    .slice(0, adet);
}

export type DagilimSatiri = { etiket: string; adet: number };

/** Etiket üreten ortak tekil-kişi dağılımı. */
function kisiDagilimi(olaylar: TakipOlayi[], etiketle: (o: TakipOlayi) => string): DagilimSatiri[] {
  const harita = new Map<string, Set<string>>();
  const adsiz = new Map<string, number>();
  for (const o of olaylar) {
    const etiket = etiketle(o) || "Bilinmiyor";
    const kisi = kisiAnahtari(o);
    if (kisi) {
      const kume = harita.get(etiket) ?? new Set<string>();
      kume.add(kisi);
      harita.set(etiket, kume);
    } else {
      adsiz.set(etiket, (adsiz.get(etiket) || 0) + 1);
    }
  }
  const tumEtiketler = new Set([...harita.keys(), ...adsiz.keys()]);
  return [...tumEtiketler]
    .map((etiket) => ({ etiket, adet: (harita.get(etiket)?.size || 0) + (adsiz.get(etiket) || 0) }))
    .sort((a, b) => b.adet - a.adet);
}

/** Tarayıcı dağılımı — tekil kişi sayısı. */
export function tarayiciDagilimi(olaylar: TakipOlayi[]): DagilimSatiri[] {
  return kisiDagilimi(olaylar, (o) => tarayiciEtiketi(o.cihaz));
}

/** İşletim sistemi dağılımı — tekil kişi sayısı. */
export function isletimDagilimi(olaylar: TakipOlayi[]): DagilimSatiri[] {
  return kisiDagilimi(olaylar, (o) => isletimEtiketi(o.cihaz));
}

/** Mobil / masaüstü / tablet / bot dağılımı — tekil kişi sayısı. */
export function cihazTuruDagilimi(olaylar: TakipOlayi[]): DagilimSatiri[] {
  return kisiDagilimi(olaylar, (o) => cihazTuru(o.cihaz));
}

/** Giriş kaynağı dağılımı (Google / şifre / yeni kayıt) — giriş olayı sayısı. */
export function kaynakDagilimi(olaylar: TakipOlayi[]): DagilimSatiri[] {
  const harita = new Map<string, number>();
  for (const o of olaylar) {
    if (o.olay !== "giris") continue;
    const etiket = o.kaynak === "google"
      ? "Google"
      : o.kaynak === "parola"
        ? "Şifre"
        : o.kaynak === "kayit"
          ? "Yeni kayıt"
          : "Bilinmiyor";
    harita.set(etiket, (harita.get(etiket) || 0) + 1);
  }
  return [...harita.entries()]
    .map(([etiket, adet]) => ({ etiket, adet }))
    .sort((a, b) => b.adet - a.adet);
}

export type KisiDevamliligi = {
  kisi: number;
  tekGun: number;
  cokGun: number;
  ortGiris: number; // kişi başına giriş
  ortSayfa: number; // kişi başına sayfa
};

/** E-postası bilinen kişilerin kaç ayrı gün geldiği ve kişi başına ortalamalar. */
export function kisiDevamliligi(olaylar: TakipOlayi[]): KisiDevamliligi {
  const harita = new Map<string, { gunler: Set<string>; giris: number; sayfa: number }>();
  for (const o of olaylar) {
    if (!o.email) continue;
    const a = o.email.toLowerCase();
    const k = harita.get(a) ?? { gunler: new Set<string>(), giris: 0, sayfa: 0 };
    k.gunler.add(gunEtiketi(o.olusturma));
    if (o.olay === "giris") k.giris++;
    else k.sayfa++;
    harita.set(a, k);
  }
  const liste = [...harita.values()];
  const kisi = liste.length;
  const yuvarla = (n: number) => (kisi ? Math.round((n / kisi) * 10) / 10 : 0);
  return {
    kisi,
    tekGun: liste.filter((k) => k.gunler.size <= 1).length,
    cokGun: liste.filter((k) => k.gunler.size > 1).length,
    ortGiris: yuvarla(liste.reduce((t, k) => t + k.giris, 0)),
    ortSayfa: yuvarla(liste.reduce((t, k) => t + k.sayfa, 0)),
  };
}

export type CanliOzet = { dakika: number; kisi: number; ziyaret: number; giris: number };

/** "Şu an sitede": son N dakikadaki tekil kişi + hareket sayısı. */
export function canliOzet(olaylar: TakipOlayi[], dakika = 5): CanliOzet {
  const sinir = Date.now() - dakika * 60 * 1000;
  const kume = new Set<string>();
  let ziyaret = 0;
  let giris = 0;
  for (const o of olaylar) {
    if (zamanMs(o.olusturma) < sinir) continue;
    if (o.olay === "ziyaret") ziyaret++;
    else giris++;
    const kisi = kisiAnahtari(o);
    if (kisi) kume.add(kisi);
  }
  return { dakika, kisi: kume.size, ziyaret, giris };
}

/* ------------------------------------------------------------------ */
/* Ek gelişmiş metrikler                                                */
/* ------------------------------------------------------------------ */

export type HaftaninGunu = {
  gun: string; // "Pazartesi" vb.
  adet: string; // ISO gün etiketi
  ziyaret: number;
  giris: number;
  tekil: number;
};

/** Haftanın günleri dağılımı: hangi günler daha yoğun. */
export function haftaninGunleri(olaylar: TakipOlayi[]): HaftaninGunu[] {
  const GUN_ADLARI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const harita = new Map<number, { ziyaret: number; giris: number; kume: Set<string> }>();
  for (const o of olaylar) {
    const d = new Date(o.olusturma);
    if (!Number.isFinite(d.getTime())) continue;
    const gunIndex = d.getUTCDay();
    const k = harita.get(gunIndex) ?? { ziyaret: 0, giris: 0, kume: new Set() };
    if (o.olay === "ziyaret") k.ziyaret++;
    else k.giris++;
    const kisi = kisiAnahtari(o);
    if (kisi) k.kume.add(kisi);
    harita.set(gunIndex, k);
  }
  return GUN_ADLARI.map((ad, i) => ({
    gun: ad,
    adet: String(i),
    ziyaret: harita.get(i)?.ziyaret ?? 0,
    giris: harita.get(i)?.giris ?? 0,
    tekil: harita.get(i)?.kume.size ?? 0,
  }));
}

export type OturumSuresi = {
  ortalamaDakika: number;
  medyanDakika: number;
  oturumSayisi: number;
};

/** Ortalama ve medyan oturum süresi (kişi bazında). */
export function oturumSuresi(olaylar: TakipOlayi[]): OturumSuresi {
  const harita = new Map<string, { ilk: number; son: number }>();
  for (const o of olaylar) {
    if (!o.email) continue;
    const a = o.email.toLowerCase();
    const t = zamanMs(o.olusturma);
    const k = harita.get(a);
    if (!k) {
      harita.set(a, { ilk: t, son: t });
    } else {
      if (t < k.ilk) k.ilk = t;
      if (t > k.son) k.son = t;
    }
  }
  const sureler: number[] = [];
  for (const { ilk, son } of harita.values()) {
    const sure = (son - ilk) / 60_000; // dakika
    if (sure > 0 && sure < 24 * 60) sureler.push(sure); // 24 saati aşanları yoksay
  }
  sureler.sort((a, b) => a - b);
  const ortalama = sureler.length ? sureler.reduce((t, s) => t + s, 0) / sureler.length : 0;
  const medyan = sureler.length ? sureler[Math.floor(sureler.length / 2)] : 0;
  return {
    ortalamaDakika: Math.round(ortalama * 10) / 10,
    medyanDakika: Math.round(medyan * 10) / 10,
    oturumSayisi: sureler.length,
  };
}

export type HemenCikma = {
  toplamZiyaretci: number;
  hemenCikan: number;
  oran: number; // 0-1
};

/** Hemen çıkma oranı: tek sayfa açıp çıkanlar. */
export function hemenCikmaOrani(olaylar: TakipOlayi[]): HemenCikma {
  const harita = new Map<string, { sayfa: number }>();
  for (const o of olaylar) {
    if (o.olay !== "ziyaret") continue;
    const kisi = kisiAnahtari(o);
    if (!kisi) continue;
    const k = harita.get(kisi) ?? { sayfa: 0 };
    k.sayfa++;
    harita.set(kisi, k);
  }
  let hemenCikan = 0;
  for (const { sayfa } of harita.values()) {
    if (sayfa === 1) hemenCikan++;
  }
  const toplam = harita.size;
  return {
    toplamZiyaretci: toplam,
    hemenCikan,
    oran: toplam > 0 ? Math.round((hemenCikan / toplam) * 1000) / 1000 : 0,
  };
}

export type YeniGeriDonen = {
  yeniKisi: number;
  geriDonen: number;
  toplam: number;
  yeniOran: number;
  geriOran: number;
};

/** Yeni vs geri gelen kullanıcı oranı. */
export function yeniGeriDonenOrani(olaylar: TakipOlayi[]): YeniGeriDonen {
  const harita = new Map<string, { gunler: Set<string> }>();
  for (const o of olaylar) {
    if (!o.email) continue;
    const a = o.email.toLowerCase();
    const k = harita.get(a) ?? { gunler: new Set() };
    k.gunler.add(gunEtiketi(o.olusturma));
    harita.set(a, k);
  }
  let yeni = 0;
  let geri = 0;
  for (const { gunler } of harita.values()) {
    if (gunler.size === 1) yeni++;
    else geri++;
  }
  const toplam = harita.size;
  return {
    yeniKisi: yeni,
    geriDonen: geri,
    toplam,
    yeniOran: toplam > 0 ? Math.round((yeni / toplam) * 1000) / 1000 : 0,
    geriOran: toplam > 0 ? Math.round((geri / toplam) * 1000) / 1000 : 0,
  };
}

export type SayfaDonusum = {
  yol: string;
  ziyaret: number;
  girisli: number;
  donusumOrani: number;
};

/** En çok kullanılan sayfaların dönüşüm oranı. */
export function sayfaDonusumOrani(olaylar: TakipOlayi[], adet = 10): SayfaDonusum[] {
  const harita = new Map<string, { ziyaret: number; girisli: number }>();
  for (const o of olaylar) {
    if (o.olay !== "ziyaret") continue;
    const yol = (o.yol || "/").split("?")[0].split("#")[0].slice(0, 200) || "/";
    const k = harita.get(yol) ?? { ziyaret: 0, girisli: 0 };
    k.ziyaret++;
    if (o.email) k.girisli++;
    harita.set(yol, k);
  }
  return [...harita.entries()]
    .map(([yol, k]) => ({
      yol,
      ziyaret: k.ziyaret,
      girisli: k.girisli,
      donusumOrani: k.ziyaret > 0 ? Math.round((k.girisli / k.ziyaret) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.ziyaret - a.ziyaret)
    .slice(0, adet);
}

/* ------------------------------------------------------------------ */
/* Traffic source analizi                                              */
/* ------------------------------------------------------------------ */

export type TrafficSource = {
  kaynak: string; // "Direct", "Google", "Organic", "Social", "Referral", "Other"
  adet: number;
  tekil: number;
  donusum: number;
};

/** Referer URL'sinden kaynak tipini çıkar. */
function refererTipi(referer: string): string {
  if (!referer) return "Direct";
  const r = referer.toLowerCase();
  if (r.includes("google.") || r.includes("bing.") || r.includes("yahoo.") || r.includes("duckduckgo.")) {
    return "Google";
  }
  if (r.includes("facebook.") || r.includes("twitter.") || r.includes("x.com") || r.includes("linkedin.") || r.includes("instagram.")) {
    return "Social";
  }
  if (r.includes("youtube.") || r.includes("tiktok.") || r.includes("pinterest.")) {
    return "Social";
  }
  // Diğer referer'lar
  return "Referral";
}

/** Traffic source dağılımı. */
export function trafficSourceAnalizi(olaylar: TakipOlayi[]): TrafficSource[] {
  const harita = new Map<string, { adet: number; kume: Set<string>; giris: number }>();
  for (const o of olaylar) {
    if (o.olay !== "ziyaret") continue;
    const kaynak = refererTipi(o.referer || "");
    const k = harita.get(kaynak) ?? { adet: 0, kume: new Set(), giris: 0 };
    k.adet++;
    const kisi = kisiAnahtari(o);
    if (kisi) k.kume.add(kisi);
    if (o.email) k.giris++;
    harita.set(kaynak, k);
  }
  return [...harita.entries()]
    .map(([kaynak, k]) => ({
      kaynak,
      adet: k.adet,
      tekil: k.kume.size,
      donusum: k.adet > 0 ? Math.round((k.giris / k.adet) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.adet - a.adet);
}

/* ------------------------------------------------------------------ */
/* Aylık karşılaştırma metrikleri                                       */
/* ------------------------------------------------------------------ */

export type AylikKarsilastirma = {
  buAy: string;
  oncekiAy: string;
  buAyZiyaret: number;
  oncekiAyZiyaret: number;
  buAyGiris: number;
  oncekiAyGiris: number;
  buAyTekil: number;
  oncekiAyTekil: number;
  ziyaretDegisim: number; // yüzde
  girisDegisim: number; // yüzde
  tekilDegisim: number; // yüzde
};

/** Bu ay ile önceki ayı karşılaştır. */
export function aylikKarsilastirma(olaylar: TakipOlayi[]): AylikKarsilastirma {
  const buAy = ayBasiEtiketi().slice(0, 7); // YYYY-MM
  const oncekiAyTarih = new Date();
  oncekiAyTarih.setMonth(oncekiAyTarih.getMonth() - 1);
  const oncekiAy = IST_GUN_FMT.format(oncekiAyTarih).slice(0, 7);

  const buAyOlaylar = olaylar.filter((o) => gunEtiketi(o.olusturma).startsWith(buAy));
  const oncekiAyOlaylar = olaylar.filter((o) => gunEtiketi(o.olusturma).startsWith(oncekiAy));

  const buAyZiyaret = buAyOlaylar.filter((o) => o.olay === "ziyaret").length;
  const oncekiAyZiyaret = oncekiAyOlaylar.filter((o) => o.olay === "ziyaret").length;
  const buAyGiris = buAyOlaylar.filter((o) => o.olay === "giris").length;
  const oncekiAyGiris = oncekiAyOlaylar.filter((o) => o.olay === "giris").length;
  const buAyTekil = tekilKisi(buAyOlaylar);
  const oncekiAyTekil = tekilKisi(oncekiAyOlaylar);

  const yuzdeHesapla = (simdiki: number, onceki: number): number => {
    if (onceki === 0) return 0;
    return Math.round(((simdiki - onceki) / onceki) * 1000) / 10;
  };

  return {
    buAy,
    oncekiAy,
    buAyZiyaret,
    oncekiAyZiyaret,
    buAyGiris,
    oncekiAyGiris,
    buAyTekil,
    oncekiAyTekil,
    ziyaretDegisim: yuzdeHesapla(buAyZiyaret, oncekiAyZiyaret),
    girisDegisim: yuzdeHesapla(buAyGiris, oncekiAyGiris),
    tekilDegisim: yuzdeHesapla(buAyTekil, oncekiAyTekil),
  };
}

/* ------------------------------------------------------------------ */
/* Cohort analizi - haftalık bazda geri dönüş                            */
/* ------------------------------------------------------------------ */

export type CohortSatiri = {
  hafta: string; // "2026-W42" gibi
  yeniKisi: number;
  hafta1: number; // 1. hafta geri dönen
  hafta2: number; // 2. hafta geri dönen
  hafta3: number; // 3. hafta geri dönen
  hafta4: number; // 4. hafta geri dönen
};

/** Haftalık cohort analizi: her hafta kayıt olanların sonraki haftalarda geri dönüşü. */
export function haftalikCohort(olaylar: TakipOlayi[], haftaSayisi = 8): CohortSatiri[] {
  const haftaBasliklari: string[] = [];
  for (let i = haftaSayisi - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    const yil = d.getFullYear();
    const hafta = Math.ceil((d.getTime() - new Date(yil, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    haftaBasliklari.push(`${yil}-W${hafta}`);
  }

  // Her hafta için yeni kullanıcıları bul
  const haftaYeniKisi = new Map<string, Set<string>>();
  for (const o of olaylar) {
    if (o.olay !== "giris" || !o.email) continue;
    const d = new Date(o.olusturma);
    const yil = d.getFullYear();
    const hafta = Math.ceil((d.getTime() - new Date(yil, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const haftaEtiket = `${yil}-W${hafta}`;
    const kume = haftaYeniKisi.get(haftaEtiket) ?? new Set();
    kume.add(o.email.toLowerCase());
    haftaYeniKisi.set(haftaEtiket, kume);
  }

  // Her kullanının hangi haftalarda geldiğini takip et
  const kisiHaftalari = new Map<string, Set<string>>();
  for (const o of olaylar) {
    if (o.olay !== "giris" || !o.email) continue;
    const d = new Date(o.olusturma);
    const yil = d.getFullYear();
    const hafta = Math.ceil((d.getTime() - new Date(yil, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const haftaEtiket = `${yil}-W${hafta}`;
    const kume = kisiHaftalari.get(o.email.toLowerCase()) ?? new Set();
    kume.add(haftaEtiket);
    kisiHaftalari.set(o.email.toLowerCase(), kume);
  }

  const sonuc: CohortSatiri[] = [];
  for (const hafta of haftaBasliklari) {
    const yeniKisi = haftaYeniKisi.get(hafta) ?? new Set();
    const yeniKisiListesi = [...yeniKisi];

    let hafta1 = 0, hafta2 = 0, hafta3 = 0, hafta4 = 0;

    for (const kisi of yeniKisiListesi) {
      const kullanicininHaftalari = kisiHaftalari.get(kisi) ?? new Set();
      const haftaIndex = haftaBasliklari.indexOf(hafta);

      if (haftaIndex + 1 < haftaBasliklari.length && kullanicininHaftalari.has(haftaBasliklari[haftaIndex + 1])) {
        hafta1++;
      }
      if (haftaIndex + 2 < haftaBasliklari.length && kullanicininHaftalari.has(haftaBasliklari[haftaIndex + 2])) {
        hafta2++;
      }
      if (haftaIndex + 3 < haftaBasliklari.length && kullanicininHaftalari.has(haftaBasliklari[haftaIndex + 3])) {
        hafta3++;
      }
      if (haftaIndex + 4 < haftaBasliklari.length && kullanicininHaftalari.has(haftaBasliklari[haftaIndex + 4])) {
        hafta4++;
      }
    }

    sonuc.push({
      hafta,
      yeniKisi: yeniKisi.size,
      hafta1,
      hafta2,
      hafta3,
      hafta4,
    });
  }

  return sonuc;
}
