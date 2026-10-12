import type { AktifZiyaret, Musteri } from "./types";

/**
 * KVKK dostu ekran maskesi.
 *
 * KURAL: Tam veri HER ZAMAN veritabanında durur (WhatsApp, arama, etiket için lazım).
 * Maske SADECE vitrinde uygulanır: liste API yanıtları + ekran gösterimi.
 * Detay (kart açma) bilinçli tekil erişimdir, tam veri verir.
 */

const YILDIZ = "*";

/** İsim: ilk 3 harf görünür, kalanı gizli. "Ahmet" → "Ahm**" */
export function maskAd(ad: string): string {
  const a = (ad ?? "").trim();
  if (!a) return "";
  if (a.length <= 3) return a;
  return `${a.slice(0, 3)}${YILDIZ.repeat(a.length - 3)}`;
}

/** Soyisim: ilk 1 harf görünür, kalanı gizli. "Gündoğan" → "G******" */
export function maskSoyad(soyad: string): string {
  const s = (soyad ?? "").trim();
  if (!s) return "";
  if (s.length <= 1) return s;
  return `${s.slice(0, 1)}${YILDIZ.repeat(s.length - 1)}`;
}

/**
 * Telefon: SADECE son 4 rakam görünür, kalanı gizli, veri SİLİNMEZ.
 * Orijinal biçim (boşluk/ayraç) korunur. "05522678192" → "*******8192"
 */
export function maskTelefon(tel: string): string {
  const t = String(tel ?? "");
  const rakamlar = t.replace(/\D/g, "");
  if (!rakamlar) return "";
  if (rakamlar.length <= 4) return `${YILDIZ.repeat(3)}${rakamlar}`;
  let gorulen = 0;
  const gizlenecek = rakamlar.length - 4;
  return t
    .split("")
    .map((ch) => {
      if (!/\d/.test(ch)) return ch;
      gorulen += 1;
      return gorulen <= gizlenecek ? YILDIZ : ch;
    })
    .join("");
}

/** Liste vitrini: isim/soyisim/telefon maskeli, not alanı boş (detayda tam). */
export function maskMusteri(m: Musteri): Musteri {
  return { ...m, ad: maskAd(m.ad), soyad: maskSoyad(m.soyad), telefon: maskTelefon(m.telefon), not: "" };
}

/** Aktif işler vitrini: isim/soyisim/telefon maskeli, not boş. */
export function maskAktif(a: AktifZiyaret): AktifZiyaret {
  return { ...a, ad: maskAd(a.ad), soyad: maskSoyad(a.soyad), telefon: maskTelefon(a.telefon), not: "" };
}
