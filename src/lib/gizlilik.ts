import type { AktifZiyaret, Musteri } from "./types";

/**
 * KVKK dostu ekran maskesi.
 *
 * KURAL: Tam veri HER ZAMAN veritabanında durur (WhatsApp, arama, etiket için lazım).
 * Maske SADECE vitrinde uygulanır: liste API yanıtları + ekran gösterimi.
 * Detay (kart açma) bilinçli tekil erişimdir, tam veri verir.
 */

const YILDIZ = "*";

/** İsim: ilk 2 harf görünür, kalanı silinip harf başına yıldız. "Taner" → "TA***" */
export function maskAd(ad: string): string {
  const a = (ad ?? "").trim();
  if (!a) return "";
  if (a.length <= 2) return a;
  return `${a.slice(0, 2)}${YILDIZ.repeat(a.length - 2)}`;
}

/** Soyisim: ilk 2 harf görünür, kalanı silinip harf başına yıldız. "Gülbaş" → "GÜ****" */
export function maskSoyad(soyad: string): string {
  const s = (soyad ?? "").trim();
  if (!s) return "";
  if (s.length <= 2) return s;
  return `${s.slice(0, 2)}${YILDIZ.repeat(s.length - 2)}`;
}

/** Soyisim kısa maske: ilk 1 harf görünür (etiket altı gibi dar alanlar için). */
export function maskSoyadKisa(soyad: string): string {
  const s = (soyad ?? "").trim();
  if (!s) return "";
  if (s.length <= 1) return s;
  return `${s.slice(0, 1)}${YILDIZ.repeat(s.length - 1)}`;
}

/**
 * Telefon: SADECE son 4 rakam görünür, öncesi ful silinip yıldızlanır
 * (boşluk/ayraç dahil her karakter yıldız olur, veri SİLİNMEZ).
 * "05522678192" → "*******8192", "0552 267 81 92" → "*********81 92"
 */
export function maskTelefon(tel: string): string {
  const t = String(tel ?? "");
  const rakamlar = t.replace(/\D/g, "");
  if (!rakamlar) return "";
  if (rakamlar.length <= 4) return `${YILDIZ.repeat(3)}${rakamlar}`;
  // Sondan 4. rakamın başladığı yeri bul, öncesini ful yıldızla, kuyruğu aynen bırak.
  const hedef = 4;
  let gorulen = 0;
  let kesim = t.length;
  for (let i = t.length - 1; i >= 0; i--) {
    if (/\d/.test(t[i])) {
      gorulen += 1;
      if (gorulen === hedef) {
        kesim = i;
        break;
      }
    }
  }
  return `${YILDIZ.repeat(kesim)}${t.slice(kesim)}`;
}

/** Liste vitrini: isim/soyisim/telefon maskeli, not alanı boş (detayda tam). */
export function maskMusteri(m: Musteri): Musteri {
  return { ...m, ad: maskAd(m.ad), soyad: maskSoyad(m.soyad), telefon: maskTelefon(m.telefon), not: "" };
}

/** Aktif işler vitrini: isim/soyisim/telefon maskeli, not boş. */
export function maskAktif(a: AktifZiyaret): AktifZiyaret {
  return { ...a, ad: maskAd(a.ad), soyad: maskSoyad(a.soyad), telefon: maskTelefon(a.telefon), not: "" };
}
