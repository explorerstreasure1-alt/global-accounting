import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Yönetici paneli oturum yardımcıları.
 * - Şifre: env ADMIN_PASSWORD (üretimde tanımlı değilse giriş kapalı)
 * - Çerez: imzalı + son kullanma tarihli jeton, httpOnly, 8 saat
 *
 * Eski sürümde çerez sadece sha256(şifre) idi: süre dolsa bile sunucu
 * tarafında geçerliliğini yitirmiyordu. Artık jeton "sonKullanma.imza"
 * biçiminde ve süre sunucuda da denetleniyor.
 */

const OTURUM_MS = 8 * 60 * 60 * 1000; // 8 saat

/** Üretimde ADMIN_PASSWORD yok mu? (o zaman yönetici girişi bilinçli olarak kapalı) */
export function adminSifreTanimsiz(): boolean {
  return process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD;
}

export function adminSifre(): string {
  return process.env.ADMIN_PASSWORD || "defterdar-admin";
}

export const ADMIN_COOKIE = "admin-ses";

function imza(govde: string): string {
  return createHmac("sha256", `admin::${adminSifre()}`).update(govde).digest("hex");
}

/** taze, imzalı oturum jetonu: "<sonKullanma>.<imza>" */
export function oturumToken(): string {
  const govde = String(Date.now() + OTURUM_MS);
  return `${govde}.${imza(govde)}`;
}

export function adminOturumGecerli(cookieDegeri: string | undefined | null): boolean {
  if (!cookieDegeri) return false;
  const [govde, gelenImza] = cookieDegeri.split(".");
  if (!govde || !gelenImza) return false;
  const beklenen = Buffer.from(imza(govde), "hex");
  const gelen = Buffer.from(gelenImza, "hex");
  if (gelen.length !== beklenen.length || gelen.length === 0) return false;
  if (!timingSafeEqual(gelen, beklenen)) return false;
  const sonKullanma = Number(govde);
  return Number.isFinite(sonKullanma) && Date.now() < sonKullanma;
}

/** Şifre karşılaştırması (zaman-güvenli). */
export function sifreDogru(gelen: string): boolean {
  const a = createHash("sha256").update(gelen ?? "").digest();
  const b = createHash("sha256").update(adminSifre()).digest();
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Kaba kuvvet yavaşlatıcı                                             */
/* ------------------------------------------------------------------ */

const PENCERE_MS = 10 * 60 * 1000;
const AZAMI_DENEME = 8;
const KILIT_MS = 5 * 60 * 1000;
const GENEL_ANAHTAR = "__genel__";
const GENEL_AZAMI = 200;

type Deneme = { adet: number; baslangic: number; kilitBitis: number };
const denemeler = new Map<string, Deneme>();

export type GirisIzin = { izin: boolean; kalanSaniye: number; kalanDeneme: number };

function temizle(simdi: number): void {
  if (denemeler.size < 2000) return;
  for (const [k, v] of denemeler) {
    if (v.kilitBitis < simdi && simdi - v.baslangic > PENCERE_MS) denemeler.delete(k);
  }
  if (denemeler.size > 5000) denemeler.clear();
}

function kayitAl(anahtar: string, simdi: number): Deneme {
  const mevcut = denemeler.get(anahtar);
  if (mevcut && simdi - mevcut.baslangic <= PENCERE_MS) return mevcut;
  const yeni: Deneme = { adet: 0, baslangic: simdi, kilitBitis: 0 };
  denemeler.set(anahtar, yeni);
  return yeni;
}

function tekIzin(anahtar: string, azami: number): GirisIzin {
  const simdi = Date.now();
  const k = denemeler.get(anahtar);
  if (!k) return { izin: true, kalanSaniye: 0, kalanDeneme: azami };
  if (k.kilitBitis > simdi) {
    return { izin: false, kalanSaniye: Math.ceil((k.kilitBitis - simdi) / 1000), kalanDeneme: 0 };
  }
  if (simdi - k.baslangic > PENCERE_MS) return { izin: true, kalanSaniye: 0, kalanDeneme: azami };
  return { izin: true, kalanSaniye: 0, kalanDeneme: Math.max(0, azami - k.adet) };
}

/** Giriş denemesi yapılabilir mi? (IP + genel sayaç) */
export function girisIzni(anahtar: string): GirisIzin {
  const ip = tekIzin(`ip:${anahtar}`, AZAMI_DENEME);
  if (!ip.izin) return ip;
  const genel = tekIzin(GENEL_ANAHTAR, GENEL_AZAMI);
  if (!genel.izin) return { ...genel, kalanDeneme: ip.kalanDeneme };
  return { izin: true, kalanSaniye: 0, kalanDeneme: Math.min(ip.kalanDeneme, genel.kalanDeneme) };
}

/** Başarısız denemeyi kaydet; kilit açıldıysa kalan süreyi döndür. */
export function girisBasarisiz(anahtar: string): GirisIzin {
  const simdi = Date.now();
  temizle(simdi);
  const kayitlar: { k: string; azami: number }[] = [
    { k: `ip:${anahtar}`, azami: AZAMI_DENEME },
    { k: GENEL_ANAHTAR, azami: GENEL_AZAMI },
  ];
  let kilit = 0;
  let kalan = AZAMI_DENEME;
  for (const { k, azami } of kayitlar) {
    const kayit = kayitAl(k, simdi);
    kayit.adet++;
    if (kayit.adet >= azami) {
      kayit.kilitBitis = simdi + KILIT_MS;
      kilit = Math.max(kilit, KILIT_MS);
    }
    kalan = Math.min(kalan, Math.max(0, azami - kayit.adet));
  }
  return {
    izin: kilit === 0,
    kalanSaniye: Math.ceil(kilit / 1000),
    kalanDeneme: kalan,
  };
}

/** Başarılı girişte sayaçları sıfırla. */
export function girisBasarili(anahtar: string): void {
  denemeler.delete(`ip:${anahtar}`);
}
