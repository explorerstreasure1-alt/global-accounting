import type { Ayarlar, Kategori, Kayit, KayitGirdi, OdemeTipi } from "./types";
import {
  AYLAR,
  addDays,
  parseISODate,
  parseTurkishNumber,
  toISODate,
  trLower,
} from "./format";
import { monthRange as monthBounds } from "./reports";

/** Ay adları + hal ekleri ("temmuz", "temmuzda", "marta", "aralığa", "ocak'ta"). */
export const AY_ADLARI =
  "ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik";
/** Ay adından sonra gelebilen Türkçe ekler. */
export const AY_EKI = "(?:[’']?(?:da|de|ta|te|dan|den|tan|ten|na|ne|ya|ye|nın|nin|nun|nün|nı|ni|nu|nü|nda|nde|ndan|nden|daki|deki|ki)|[ğg][ae]|[ae])?";

/** Sayısal tarih çeşitleri: 04.08.2026, 04 08 2026, 04.08. 2026, 0408 2026, 04082026 */
export const SAYISAL_TARIH_DESENI =
  "\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s*\\.?\\s*\\d{2,4}|[0-3]\\d[0-1]\\d\\s*\\d{4}|[0-3]\\d[0-1]\\d\\d{4}";

export type NlpIntent =
  | { type: "ekle"; kayit: KayitGirdi; confidence: number; not?: string }
  | { type: "ekle_coklu"; kayitlar: KayitGirdi[]; confidence: number }
  | { type: "guncelle"; filtre: KayitFiltresi; patch: Partial<KayitGirdi>; confidence: number }
  | { type: "sil"; filtre: KayitFiltresi; confidence: number }
  | {
      type: "rapor";
      tip: "gunluk" | "kasa" | "karzarar" | "kira" | "nakitkart" | "z" | "gunsonu" | "aysonu" | "kategori" | "ozet";
      baslangic?: string;
      bitis?: string;
      kategori?: Kategori;
      confidence: number;
    }
  | { type: "bol_kira"; ay: number; confidence: number }
  | { type: "ayar"; patch: Partial<Ayarlar>; confidence: number }
  | { type: "listele"; filtre: KayitAraligi; confidence: number }
  | { type: "toplu_sil"; filtre: KayitAraligi; onayla: boolean; confidence: number }
  | { type: "indir_rapor"; tip: "defter" | "z" | "gunsonu" | "aysonu" | "karzarar" | "ozet"; baslangic: string; bitis: string; confidence: number }
  | { type: "indir_yedek"; confidence: number }
  | { type: "restore_backup"; confirm: boolean; confidence: number }
  | { type: "reset_all"; confirm: boolean; confidence: number }
  | { type: "netlestir"; mesaj: string; confidence: number }
  | { type: "temizle"; confidence: number }
  | { type: "yardim"; confidence: number }
  | { type: "sohbet"; confidence: number };

export type KayitFiltresi = {
  tarih?: string;
  kategori?: Kategori;
  aciklamaIcerir?: string;
  tutar?: number;
  sonMu?: boolean;
  odemeTipi?: OdemeTipi;
  tur?: "gelir" | "gider";
};

/** Tarih aralıklı filtre (listeleme / toplu silme için) */
export type KayitAraligi = {
  baslangic?: string;
  bitis?: string;
  kategori?: Kategori;
  odemeTipi?: OdemeTipi;
  tur?: "gelir" | "gider";
};

const KATEGORI_ANAHTAR: { kategori: Kategori; keys: string[] }[] = [
  { kategori: "Kira", keys: ["kira", "kirası", "kirasi", "rent"] },
  { kategori: "Elektrik", keys: ["elektrik", "elektrik faturası", "elektrik faturasi", "aydınlatma"] },
  { kategori: "Su", keys: ["su faturası", "su faturasi", "su "] },
  { kategori: "Doğalgaz", keys: ["doğalgaz", "dogalgaz", "gaz faturası", "gaz faturasi"] },
  { kategori: "Ev", keys: ["ev ", "evde", "ev gider", "ev market"] },
  { kategori: "İş Yeri", keys: ["iş yeri", "is yeri", "dükkan", "dukkan", "işyeri", "isyeri", "mağaza", "magaza"] },
  { kategori: "Hizmet", keys: ["hizmet", "hizmetler", "hizmet geliri", "servis", "satış", "satis", "ciro", "hasılat", "hasilat", "günlük satış", "gunluk satis", "paça", "paca", "terzi", "dikim", "tadilat", "tamir"] },
  { kategori: "Market", keys: ["market", "bakkal", "alışveriş", "alisveris", "gıda", "gida"] },
];

export function detectKategori(text: string): Kategori | null {
  for (const item of KATEGORI_ANAHTAR) {
    if (item.keys.some((k) => text.includes(k))) return item.kategori;
  }
  return null;
}

function detectOdeme(text: string): OdemeTipi | null {
  // "deftere" içindeki "eft" Havale sanılmasın diye defter sözcükleri ayıklanır.
  const temiz = text.replace(/defter\w*/g, " ");
  if (/iban|ıban|havale|eft|fast/.test(temiz)) return "Havale";
  if (/\bkart\b|kredi kart|pos\b|krediyle/.test(temiz)) return "Kart";
  if (/\bnakit\b|elden|peşin|pesin|cash/.test(temiz)) return "Nakit";
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Metindeki tam tarihleri boşlukla değiştirir (tutar sanılmasınlar). Ay/gün geçerliliği kontrol edilir. */
function tarihleriCikar(text: string): string {
  const gecerliMi = (gun: string, ay: string): boolean => {
    const g = Number(gun);
    const a = Number(ay);
    return g >= 1 && g <= 31 && a >= 1 && a <= 12;
  };
  return text
    .replace(
      new RegExp(`\\b\\d{1,2}\\s*(?:${AY_ADLARI})${AY_EKI}(?:\\s+\\d{4})?\\b`, "gi"),
      " ",
    )
    // "04.08. 2026" / "04.08.2026" (nokta-boşluklu yıl)
    .replace(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*\.?\s*(\d{4})\b/g, (m, gun: string, ay: string) =>
      gecerliMi(gun, ay) ? " " : m,
    )
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m, y: string, ay: string, gun: string) =>
      Number(ay) >= 1 && Number(ay) <= 12 && Number(gun) >= 1 && Number(gun) <= 31 ? " " : m,
    )
    .replace(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g, (m, g1: string, g2: string) =>
      gecerliMi(g1, g2) ? " " : m,
    )
    // Bitişik gün-ay-yıl ("04082026") ve bitişik gün-ay + yıl ("0408 2026")
    .replace(/\b([0-3]\d)([0-1]\d)(\d{4})\b/g, (m, gun: string, ay: string) =>
      gecerliMi(gun, ay) ? " " : m,
    )
    .replace(/\b([0-3]\d)([0-1]\d)\s+(\d{4})\b/g, (m, gun: string, ay: string) =>
      gecerliMi(gun, ay) ? " " : m,
    )
    // Yılsız tarih parçası ("04.08." / "4-8") — tutar sanılmasın
    .replace(/\b(\d{1,2})[./-](\d{1,2})[./-](?!\d)/g, (m, g1: string, g2: string) =>
      gecerliMi(g1, g2) ? " " : m,
    )
    .replace(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})\b/g, (m, g1: string, g2: string) =>
      gecerliMi(g1, g2) ? " " : m,
    );
}

function extractAmounts(text: string): number[] {
  // Önce tam tarihleri çıkar ("12.03.2024" ve "26 06 2026" tutar sanılmasın)
  const tarihsiz = tarihleriCikar(text);
  const amounts: number[] = [];
  const re =
    /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(bin|milyon)?\s*(?:tl|₺)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tarihsiz))) {
    const n = parseTurkishNumber(m[1]);
    if (n != null && n > 0) {
      // Çıplak 4 haneli yıl sayısını tutar sanma ("2024 hedefim" ≠ 2024 TL).
      // TL/₺/lira/bin/milyon eki varsa paradır, alınır.
      const ekliMi =
        m[2] != null || /(tl|₺|lira|lirası|lirasi)\s*$/i.test(m[0]);
      const duz = m[1].replace(/[.,]/g, "");
      if (!ekliMi && /^(19|20)\d{2}$/.test(duz)) continue;
      const sonrakiMetin = tarihsiz.slice(m.index + m[0].length, m.index + m[0].length + 14);
      if (!ekliMi && /^\s*(?:aylık|aylik|ay|gün|gun|hafta|haftalık|haftalik|yıl|yil|sene|adet|kişi|kisi|saat|paça|paca|parça|parca|ürün|urun|tane|çift|cift)\b/i.test(sonrakiMetin)) continue;
      // Kuruş: "50 kuruş" → 0,50 TL
      if (/^\s*kuru[şs]/i.test(sonrakiMetin)) {
        amounts.push(Math.round((n / 100) * 100) / 100);
        continue;
      }
      const carp = m[2]
        ? trLower(m[2]).startsWith("milyon")
          ? 1000000
          : 1000
        : 1;
      amounts.push(n * carp);
    }
  }
  const yaziylaTutar: Array<[RegExp, number]> = [
    [/(?:^|\s)sekiz(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 800],
    [/(?:^|\s)yedi(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 700],
    [/(?:^|\s)altı(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 600],
    [/(?:^|\s)beş(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 500],
    [/(?:^|\s)dört(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 400],
    [/(?:^|\s)üç(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 300],
    [/(?:^|\s)iki(?:\s*yüz|yüz)(?=$|\s|[.,])/g, 200],
  ];
  const normalizedText = trLower(tarihsiz);
  for (const [pattern, value] of yaziylaTutar) {
    if (pattern.test(normalizedText)) amounts.push(value);
    pattern.lastIndex = 0;
  }
  return amounts;
}

function parseExplicitDate(text: string, today: string): string | null {
  const now = parseISODate(today);
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  // 12.03.2024 / 12-03-24 / "26 06 2026" / "04.08. 2026" / "0408 2026" / "04082026" — geçmişe yazım için kritik
  const dmy = text.match(
    /\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*\.?\s*(\d{2,4})\b|\b([0-3]\d)([0-1]\d)\s*(\d{4})\b|\b([0-3]\d)([0-1]\d)(\d{4})\b/,
  );
  if (dmy) {
    const day = Number(dmy[1] ?? dmy[4] ?? dmy[7]);
    const month = Number(dmy[2] ?? dmy[5] ?? dmy[8]);
    let year = Number(dmy[3] ?? dmy[6] ?? dmy[9]);
    if (year < 100) year += 2000;
    return validDate(year, month, day);
  }
  // "5 ocak", "5 ocakta", "31 temmuzda", "5 ocak 2023" (yıl belirtilmezse en yakın geçmiş yıl seçilir)
  const named = text.match(
    new RegExp(`\\b(\\d{1,2})\\s*(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)${AY_EKI}(?:\\s+(\\d{4}))?\\b`),
  );
  if (named) {
    const day = Number(named[1]);
    const rawAy = named[2]
      .replace("subat", "şubat")
      .replace("mayis", "mayıs")
      .replace("agustos", "ağustos")
      .replace("eylul", "eylül")
      .replace("kasim", "kasım")
      .replace("aralik", "aralık");
    const month = AYLAR.indexOf(rawAy) + 1;
    if (month > 0) {
      let year = named[3] ? Number(named[3]) : now.getFullYear();
      // Yıl yoksa ve tarih gelecekte kalıyorsa (örn: bugün ekim, "aralık" denirse) geçen seneyi değil bu seneyi;
      // ama "geçen" ifadesi varsa bir önceki yılı kullan — geçmişe yazım kolaylığı
      if (!named[3]) {
        const aday = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (aday > today && /geçen|gecen|geçmiş|gecmis/.test(text)) {
          year -= 1;
          return validDate(year, month, day);
        }
      }
      return validDate(year, month, day);
    }
  }
  // "ocak 2024" / "mart 2023" / "temmuzda 2024" → ayın 1'i
  const ayYil = text.match(
    new RegExp(`\\b(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)${AY_EKI}\\s+(\\d{4})\\b`),
  );
  if (ayYil) {
    const rawAy = ayYil[1]
      .replace("subat", "şubat")
      .replace("mayis", "mayıs")
      .replace("agustos", "ağustos")
      .replace("eylul", "eylül")
      .replace("kasim", "kasım")
      .replace("aralik", "aralık");
    const month = AYLAR.indexOf(rawAy) + 1;
    if (month > 0) return `${ayYil[2]}-${String(month).padStart(2, "0")}-01`;
  }
  return null;
}

function parseDate(text: string, today: string): string | null {
  if (/\bbugün\b|\bbugun\b/.test(text)) return today;
  if (/\bdün\b|\bdun\b/.test(text)) return addDays(today, -1);
  if (/evvelsi|önceki gün|onceki gun/.test(text)) return addDays(today, -2);
  if (/yarın|yarin/.test(text)) return addDays(today, 1);
  const gunOnce = text.match(/(\d+)\s*(?:gün|gun)\s*(?:önce|once)/);
  if (gunOnce) return addDays(today, -Number(gunOnce[1]));
  // "2 hafta önce"
  const haftaOnce = text.match(/(\d+)\s*hafta\s*(?:önce|once)/);
  if (haftaOnce) return addDays(today, -Number(haftaOnce[1]) * 7);
  // "3 ay önce"
  const ayOnce = text.match(/(\d+)\s*ay\s*(?:önce|once)/);
  if (ayOnce) {
    const d = parseISODate(today);
    d.setMonth(d.getMonth() - Number(ayOnce[1]));
    return toISODate(d);
  }
  // "geçen yıl", "gecen yil", "geçen sene"
  if (/geçen\s*(yıl|yil|sene)|gecen\s*(yil|sene)/.test(text)) {
    const d = parseISODate(today);
    return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // "geçen hafta"
  if (/geçen\s*hafta|gecen\s*hafta/.test(text)) return addDays(today, -7);
  const explicitDate = parseExplicitDate(text, today);
  if (explicitDate) return explicitDate;
  // Hafta günleri takvim haftasına göre hesaplanır; "geçen salı" önceki haftanın salısıdır.
  const gunAdlari: Record<string, number> = {
    pazar: 0,
    pazartesi: 1,
    pazartsi: 1,
    sali: 2,
    "salı": 2,
    carsamba: 3,
    "çarşamba": 3,
    persembe: 4,
    "perşembe": 4,
    cuma: 5,
    cumartesi: 6,
  };
  for (const ad of Object.keys(gunAdlari)) {
    if (new RegExp(`(?:^|[\\s.,;:])${ad}(?=[\\s.,;:]|$)`).test(text)) {
      const targetDay = gunAdlari[ad];
      const mondayOffset = (parseISODate(today).getDay() + 6) % 7;
      const thisMonday = addDays(today, -mondayOffset);
      const targetOffset = targetDay === 0 ? 6 : targetDay - 1;
      if (/geçen|gecen|önceki|onceki/.test(text)) return addDays(thisMonday, targetOffset - 7);
      if (/gelecek|önümüzdeki|onumuzdeki/.test(text)) return addDays(thisMonday, targetOffset + 7);
      if (/bu hafta|bu /.test(text)) return addDays(thisMonday, targetOffset);
      const todayOffset = (parseISODate(today).getDay() + 6) % 7;
      return addDays(today, -((todayOffset - targetOffset + 7) % 7));
    }
  }
  return parseExplicitDate(text, today);
}

export function parseRange(text: string, today: string): { baslangic: string; bitis: string } | null {
  const now = parseISODate(today);
  const sayiCoz = (s: string): number | null => {
    if (/^\d+$/.test(s)) return Number(s);
    const kelime: Record<string, number> = {
      bir: 1, iki: 2, "üç": 3, uc: 3, "dört": 4, dort: 4, "beş": 5, bes: 5,
      "altı": 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
    };
    return kelime[s] ?? null;
  };
  // "son 3 ay", "son üç ayın raporu" → geriye N ay (bu ay dahil), bitiş bugün
  const sonN = text.match(/son\s+(bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz|on|\d+)\s*ay[iı]n|son\s+(bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz|on|\d+)\s*ay\b/);
  if (sonN) {
    const n = sayiCoz(sonN[1] ?? sonN[2]) ?? 3;
    if (n >= 1 && n <= 24) {
      const bas = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
      const baslangic = `${bas.getFullYear()}-${String(bas.getMonth() + 1).padStart(2, "0")}-01`;
      return { baslangic, bitis: today };
    }
  }
  // "iki ay önce", "2 ay önceki rapor", "2 ay onceki" → o ayın tamamı
  const nAyOnce = text.match(/(bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz|on|\d+)\s*ay\s*(?:önce|once)(?:ki|den)?/);
  if (nAyOnce) {
    const n = sayiCoz(nAyOnce[1]) ?? 1;
    if (n >= 1 && n <= 24) {
      const hedef = new Date(now.getFullYear(), now.getMonth() - n, 1);
      return monthBounds(hedef.getFullYear(), hedef.getMonth() + 1);
    }
  }
  if (/geçen\s*yıl|gecen\s*yil|geçen\s*sene|gecen\s*sene/.test(text)) {
    const y = now.getFullYear() - 1;
    return { baslangic: `${y}-01-01`, bitis: `${y}-12-31` };
  }
  if (/bu yıl|bu yil|bu sene/.test(text)) {
    const y = now.getFullYear();
    return { baslangic: `${y}-01-01`, bitis: `${y}-12-31` };
  }
  // "mart ayı", "ağustos ay sonu", "mart 2024", "temmuzda", "geçen mart" gibi adlandırılmış aylar.
  // "5 ocak" gibi gün+ay ise GÜNdür, aralık değil — gün mantığına bırak.
  const adAy = text.match(
    new RegExp(`\\b(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)${AY_EKI}(?:\\s+ay[ıi])?`),
  );
  const AY = "ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik";
  // "1 ağustos ile 5 ağustos" (gün-ay ile gün-ay) — gün-ay korumasından ÖNCE bakılır.
  const ikiTarihAyli = text.match(
    new RegExp(`(\\d{1,2})\\s*(${AY})${AY_EKI}\\s*(?:ile|ve|-)\\s*(\\d{1,2})\\s*(${AY})${AY_EKI}`),
  );
  if (ikiTarihAyli) {
    const a = parseDate(`${ikiTarihAyli[1]} ${ikiTarihAyli[2]}`, today);
    let b = parseDate(`${ikiTarihAyli[3]} ${ikiTarihAyli[4]}`, today);
    if (a && b) {
      if (b < a) b = `${Number(b.slice(0, 4)) + 1}${b.slice(4)}`;
      return { baslangic: a, bitis: b };
    }
  }
  // "4 ve 8 ekim", "1-15 mart" (gün ile gün ay) — bu da korumadan önce.
  const twoDatesErken = text.match(
    new RegExp(`(\\d{1,2})\\s*(?:ile|ve|-|–|—)\\s*(\\d{1,2})\\s*(${AY})${AY_EKI}`),
  );
  if (twoDatesErken) {
    const fake = parseDate(`${twoDatesErken[1]} ${twoDatesErken[3]}`, today);
    const fake2 = parseDate(`${twoDatesErken[2]} ${twoDatesErken[3]}`, today);
    if (fake && fake2) return { baslangic: fake, bitis: fake2 };
  }
  const gunAyMi = new RegExp(`\\b\\d{1,2}\\s*(?:${AY_ADLARI})`).test(text);
  if (gunAyMi) return null;
  if (adAy && (/(ay[ıi]|aylık|aylik|\bay\b|rapor|özet|ozet|listele|göster|goster|sil|döküm|dokum)/.test(text) || /\b20\d{2}\b/.test(text))) {
    const rawAy = adAy[1]
      .replace("subat", "şubat")
      .replace("mayis", "mayıs")
      .replace("agustos", "ağustos")
      .replace("eylul", "eylül")
      .replace("kasim", "kasım")
      .replace("aralik", "aralık");
    const ayNo = AYLAR.indexOf(rawAy) + 1;
    if (ayNo > 0) {
      let yil = now.getFullYear();
      // Yıl belirtilmediyse ve ay henüz gelmediyse geçen seneyi al ("mart ayı" ekimde = bu seneki mart)
      if (!/\d{4}/.test(text) && ayNo > now.getMonth() + 1) yil -= 1;
      const yilEslesme = text.match(/\b(20\d{2})\b/);
      if (yilEslesme) yil = Number(yilEslesme[1]);
      return monthBounds(yil, ayNo);
    }
  }
  if (/bu ay|ayın|ayin/.test(text) && !/geçen ay|gecen ay/.test(text)) {
    return monthBounds(now.getFullYear(), now.getMonth() + 1);
  }
  if (/geçen ay|gecen ay/.test(text)) {
    const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return monthBounds(p.getFullYear(), p.getMonth() + 1);
  }
  if (/bu hafta/.test(text)) {
    const day = now.getDay() || 7;
    const bas = addDays(today, 1 - day);
    return { baslangic: bas, bitis: today };
  }
  const between = text.match(
    /(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\s*(?:ile|ve|-|–|—|\/|arası|arasi)\s*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/,
  );
  if (between) {
    const y = now.getFullYear();
    const parsePart = (raw: string) => {
      const full = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
      if (full) {
        let year = Number(full[3]);
        if (year < 100) year += 2000;
        return `${year}-${String(Number(full[2])).padStart(2, "0")}-${String(Number(full[1])).padStart(2, "0")}`;
      }
      const short = raw.match(/^(\d{1,2})[./-](\d{1,2})$/);
      if (short) {
        return `${y}-${String(Number(short[2])).padStart(2, "0")}-${String(Number(short[1])).padStart(2, "0")}`;
      }
      return null;
    };
    const a = parsePart(between[1]);
    const b = parsePart(between[2]);
    if (a && b) return { baslangic: a, bitis: b };
  }
  const twoDates = text.match(
    new RegExp(`(\\d{1,2})\\s*(?:ile|ve|-|–|—)\\s*(\\d{1,2})\\s*(${AY})${AY_EKI}`),
  );
  if (twoDates) {
    const fake = parseDate(`${twoDates[1]} ${twoDates[3]}`, today);
    const fake2 = parseDate(`${twoDates[2]} ${twoDates[3]}`, today);
    if (fake && fake2) return { baslangic: fake, bitis: fake2 };
  }
  return null;
}

/** Soru cümlesi mi? Soru asla kayıt açmaz — listeler veya sohbet eder. */
export function isQuestion(text: string): boolean {
  if (/[?]\s*$/.test(text)) return true;
  return /\b(ne|neler|nedir|nelerdir|kaç|kac|hangi|hangisi|hangileri|kim|neden|niçin|nicin|nasıl|nasil|var mı|varmi|yok mu|göster|goster|liste|soyle|söyle|anlat|bul|getir|durum|özet|ozet|bak|bakayım|bakalim|miyim|misin|mi|mı|mu|mü)\b/.test(text);
}

function isIncome(text: string, kategori: Kategori | null): boolean {  if (/gider|ödedim|odedim|fatura|masraf|harcama|aldım|aldim|ödeme|odeme/.test(text)) return false;
  if (/satış|satis|hizmet|servis|ciro|hasılat|hasilat|gelir|tahsil|kasa giriş|kasa giris|paça kısalt|paca kisalt|terzi|dikim|tadilat|tamir/.test(text)) return true;
  return kategori === "Hizmet";
}

function buildDescription(raw: string): string {
  let description = tarihleriCikar(raw.trim());
  // Açıkta kalmış ay adları + ekleri açıklamaya sızmasın ("temmuzda", "marta")
  description = description.replace(
    new RegExp(`(^|[\\s,.!?;:–—-])(?:\\d{1,2}\\s*)?(?:${AY_ADLARI})${AY_EKI}(?=$|[\\s,.!?;:–—-])`, "gi"),
    " ",
  );
  description = description.replace(
    /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:bin|milyon)?\s*(?:tl|₺)?/gi,
    " ",
  );
  description = description.replace(/(?:sekiz|yedi|altı|beş|dört|üç|iki)\s*yüz|\bsekizyüz\b/gi, " ");
  description = description.replace(
    /(?:^|\s)(?:geçen|gecen|önceki|onceki|bu|gelecek|önümüzdeki|onumuzdeki)\s+(?:hafta|ay|yıl|yil|sene|pazar|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi)(?=\s|$)/gi,
    " ",
  );
  description = description.replace(
    /(^|[\s,.!?;:–—-])(?:bugün|bugun|dün|dun|evvelsi gün|önceki gün|onceki gun|yarın|yarin|nakit|kart ile|kartla|kart|iban(?:'a|’a)?|ıban(?:'a|’a)?|havale|eft|fast|kuruş|kurus|gelir|gider|tutarı|tutari|tutar|tarihinde|tarihindeki|tarihli|tarihe|biri|birisi|diğeri|digeri|öteki|oteki|ekle|ekleyin|bu|pazar|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|kaydını|kaydini|kaydi|kaydı|kayıt|kayit|satırını|satirini|sil|silinsin|yap|yapın|yapin|değiştir|degistir|öded[ıi]m|yapt[ıi]m|ald[ıi]m|aylık|aylik|son|abi|abicim|kardeş|kardes|kardesim|usta|ustam|hocam|kanka|birader|canım|değil|degil|olacak|olsun|olmalı|olmal[iı]|yanlış|yanlis|doğrusu|dogrusu|yerine|duzelt|düzelt)(?=$|[\s,.!?;:–—-])/gi,
    " ",
  );
  const seen = new Set<string>();
  return description
    .replace(/[,.!?;:–—-]+/g, " ")
    .split(/\s+/)
    .filter((word) => {
      const normalized = trLower(word);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(" ")
    .trim();
}

export function parseCommand(raw: string, today = toISODate()): NlpIntent {
  const text = trLower(raw.trim());
  if (!text) return { type: "sohbet", confidence: 0 };

  if (/yardım|yardim|ne yapabilir|nasıl kullan|nasil kullan|komut/.test(text) && extractAmounts(text).length === 0) {
    return { type: "yardim", confidence: 0.9 };
  }

  // Sohbet temizliği (kayıtlara dokunmaz)
  if (/(sohbeti?|konu[şs]may[ıi]|mesajlar[ıi])\s*(temizle|sil)|^temizle$/.test(text)) {
    return { type: "temizle", confidence: 0.95 };
  }

  if (/(yedek|yedeğ).*(geri yükle|geri yukle)|(geri yükle|geri yukle).*(yedek|yedeğ)/.test(text)) {
    return { type: "restore_backup", confirm: /onaylıyorum|onayliyorum|onayla/.test(text), confidence: 0.98 };
  }
  if (/tüm verileri sıfırla|tum verileri sifirla|tüm defteri sıfırla|tum defteri sifirla/.test(text)) {
    return { type: "reset_all", confirm: /onaylıyorum|onayliyorum|onayla/.test(text), confidence: 0.98 };
  }

  // Dosya indirme ("z raporunu indir", "gün sonu çıkar", "ay sonunu excel al", "yedeğimi indir")
  // Not: metin raporlardan ÖNCE bakılır — "indir/çıkar" diyen dosya ister
  if (/indir|çıktı al|cikti al|çıkar|çıkart|cikar|cikart/.test(text) && /z rapor|zrapor|gün sonu|gun sonu|ay sonu|aysonu|excel|rapor|yedek|yedeğ|döküm|dokum|defter|\bkar\b|\bzarar|\bkâr\b/.test(text)) {
    if (/yedek|yedeğ/.test(text)) return { type: "indir_yedek", confidence: 0.93 };
    let tip: "defter" | "z" | "gunsonu" | "aysonu" | "karzarar" | "ozet" = "ozet";
    if (/z rapor|zrapor/.test(text)) tip = "z";
    else if (/gün sonu|gun sonu/.test(text)) tip = "gunsonu";
    else if (/ay sonu|aysonu/.test(text)) tip = "aysonu";
    else if (/defter|kayıt dökümü|kayit dokumu/.test(text)) tip = "defter";
    else if (/\bkar\b|\bzarar|\bkâr\b/.test(text)) tip = "karzarar";
    const nowI = parseISODate(today);
    const range = tip === "defter"
      ? { baslangic: "2000-01-01", bitis: "2100-12-31" }
      : parseRange(text, today) ?? monthBounds(nowI.getFullYear(), nowI.getMonth() + 1);
    const tek = tip === "gunsonu" ? (parseDate(text, today) ?? today) : undefined;
    return {
      type: "indir_rapor",
      tip,
      baslangic: tek ?? range.baslangic,
      bitis: tek ?? range.bitis,
      confidence: 0.93,
    };
  }

  if (/(\d+)\s*aya\s*böl|aya böl|aylık dağıt|aylik dagit/.test(text) && /kira/.test(text)) {
    const m = text.match(/(\d+)\s*ay/);
    return { type: "bol_kira", ay: m ? Number(m[1]) : 3, confidence: 0.86 };
  }

  if (/işletme adı|isletme adi|dükkan adı|dukkan adi|mağaza adı/.test(text)) {
    const name = raw.match(/(?:adı|adi)\s*[:\-]?\s*(.+)$/i);
    if (name) {
      return { type: "ayar", patch: { isletmeAdi: name[1].trim() }, confidence: 0.8 };
    }
  }

  // Kira / açılış ayarı ("kira 150 bin olsun", "açılış bakiyesi 5 bin yap")
  if (/kira/.test(text) && /(olsun|olarak|ayarla|güncelle|guncelle|değiştir|degistir)/.test(text)) {
    const amounts = extractAmounts(text);
    const patch: Partial<Ayarlar> = {};
    if (amounts[0] != null) patch.kiraTutari = amounts[0];
    const per = text.match(/(\d+)\s*ay/);
    if (per) patch.kiraPeriyodu = Number(per[1]);
    const odemeGunu = parseDate(text, today);
    if (odemeGunu && /sonraki|ödeme|odeme|tarih/.test(text)) patch.kiraSonrakiTarih = odemeGunu;
    if (Object.keys(patch).length > 0) return { type: "ayar", patch, confidence: 0.85 };
  }
  if (/(açılış|acilis)\s*bakiye/.test(text) && /(olsun|olarak|ayarla|güncelle|guncelle|yap|değiştir|degistir)/.test(text)) {
    const amounts = extractAmounts(text);
    if (amounts[0] != null) {
      return { type: "ayar", patch: { acilisBakiyesi: amounts[0] }, confidence: 0.85 };
    }
  }

  if (/z\s*rapor|zrapor|nakit kart rapor|iki tarih/.test(text)) {
    const range = parseRange(text, today);
    return {
      type: "rapor",
      tip: "z",
      baslangic: range?.baslangic,
      bitis: range?.bitis,
      confidence: 0.92,
    };
  }
  if (/ay sonu|aysonu|aylık kapanış|aylik kapanis|ay kapanış|ay kapanis/.test(text)) {
    const nowAy = parseISODate(today);
    const rangeAy = parseRange(text, today) ?? monthBounds(nowAy.getFullYear(), nowAy.getMonth() + 1);
    return { type: "rapor", tip: "aysonu", ...rangeAy, confidence: 0.92 };
  }
  if (/gün sonu|gun sonu|günsonu|kasa kapa|kapanış rapor|kapanis rapor/.test(text)) {
    const tarih = parseDate(text, today) ?? today;
    return { type: "rapor", tip: "gunsonu", baslangic: tarih, bitis: tarih, confidence: 0.92 };
  }
  if (/kar[-\s]?zarar|kâr|kar durum|zarar durum/.test(text)) {
    const range = parseRange(text, today) ?? monthBounds(parseISODate(today).getFullYear(), parseISODate(today).getMonth() + 1);
    return { type: "rapor", tip: "karzarar", ...range, confidence: 0.9 };
  }
  if (/kira.*kal|kalan kira|kira hatır|kira hatir|aylık kira|aylik kira/.test(text)) {
    return { type: "rapor", tip: "kira", confidence: 0.9 };
  }
  if (/nakit ve kart|kart toplam|nakit toplam|ödeme tipi|odeme tipi/.test(text)) {
    const range = parseRange(text, today);
    return { type: "rapor", tip: "nakitkart", ...range, confidence: 0.88 };
  }
  if (/günlük (özet|kasa|toplam)|gunluk (ozet|kasa|toplam)|kasa (durum|toplam|kaç|kac)/.test(text)) {
    const tarih = parseDate(text, today) ?? today;
    return { type: "rapor", tip: "gunluk", baslangic: tarih, bitis: tarih, confidence: 0.88 };
  }
  if (/özet|ozet/.test(text)) {
    const range = parseRange(text, today);
    return { type: "rapor", tip: "ozet", ...range, confidence: 0.8 };
  }

  const kategoriRapor = detectKategori(text);
  if (kategoriRapor && /(ne kadar|kaç|kac|toplam|geldi|gitti|bu ay)/.test(text) && !/ödedim|odedim|yaptım|yaptim|ekle/.test(text)) {
    const range = parseRange(text, today) ?? monthBounds(parseISODate(today).getFullYear(), parseISODate(today).getMonth() + 1);
    return { type: "rapor", tip: "kategori", kategori: kategoriRapor, ...range, confidence: 0.86 };
  }

  // Kayıt listeleme ("mart ayı satışları göster", "bugünkü kayıtlar ne var")
  // Not: "satışların" içindeki "sil" hecesi eleme yapmasın diye kelime bazlı bakılır
  if (
    /listele|göster|goster|döküm|dokum|ne var|neler var/.test(text) &&
    !/(?:^|\s)sil(?:\s|$)|siline|düzelt|duzelt|güncelle|guncelle|ekle|kaydet|ödedim|odedim|yaptım|yaptim/.test(text)
  ) {
    const range = parseRange(text, today);
    const tekTarih = range ? undefined : (parseDate(text, today) ?? undefined);
    return {
      type: "listele",
      filtre: {
        baslangic: range?.baslangic ?? tekTarih,
        bitis: range?.bitis ?? tekTarih,
        kategori: detectKategori(text) ?? undefined,
        odemeTipi: detectOdeme(text) ?? undefined,
      },
      confidence: 0.84,
    };
  }

  const tekTarihliSilme = /(?:sil$|siline|kayıt sil|kayit sil|iptal et)/.test(text);
  const acikTarihVarmi = new RegExp(
    `\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b(?:${SAYISAL_TARIH_DESENI})\\b|\\b\\d{1,2}\\s*(?:${AY_ADLARI})${AY_EKI}\\b`,
    "i",
  ).test(text);
  if (tekTarihliSilme && acikTarihVarmi) {
    const kategori = detectKategori(text) ?? undefined;
    const tarih = parseDate(text, today) ?? undefined;
    const aciklamaIcerir = buildDescription(raw) || undefined;
    const amounts = extractAmounts(text);
    const tutar = amounts.length === 1 ? amounts[0] : undefined;
    return {
      type: "sil",
      filtre: { kategori, tarih, aciklamaIcerir, tutar, sonMu: /\bson\b/.test(text) },
      confidence: 0.91,
    };
  }

  // Toplu silme: kapsam (aralık/kategori) + "sil" varsa toplu; "onayla" varsa uygula
  if (/sil/.test(text)) {
    const topluKapsam = parseRange(text, today);
    const topluKat = detectKategori(text) ?? undefined;
    const topluMu =
      /tüm|tum|hepsi|toplu/.test(text) ||
      (topluKapsam != null && (topluKat != null || /kayıt|kayit|harcama|masraf/.test(text)));
    if (topluMu) {
      const onayla = /onayla|onaylıyorum|onayliyorum|evet|kesin|tamam sil/.test(text);
      return {
        type: "toplu_sil",
        filtre: {
          baslangic: topluKapsam?.baslangic,
          bitis: topluKapsam?.bitis,
          kategori: topluKat,
          odemeTipi: detectOdeme(text) ?? undefined,
        },
        onayla,
        confidence: 0.86,
      };
    }
  }

  if (/sil$|siline|kayıt sil|kayit sil|son .*sil|iptal et/.test(text)) {
    const kategori = detectKategori(text) ?? undefined;
    const tarih = parseDate(text, today) ?? undefined;
    const aciklamaIcerir = buildDescription(raw) || undefined;
    const amounts = extractAmounts(text);
    const tutar = amounts.length === 1 ? amounts[0] : undefined;
    const sonMu = /\bson\b/.test(text);
    if (!tarih && !kategori && !aciklamaIcerir && tutar == null && !sonMu) {
      return { type: "netlestir", mesaj: "Hangi kaydı sileyim? Tarihini ve açıklamasını söyler misiniz?", confidence: 0.99 };
    }
    return {
      type: "sil",
      filtre: { kategori, tarih, sonMu, aciklamaIcerir, tutar },
      confidence: 0.84,
    };
  }

  // Doğrudan düzeltme dili ("kart değil nakit olacak", "yanlış girmişsin doğrusu 1800").
  // "kayıt" kelimesi geçmese de düzeltme niyetidir.
  if (
    /(değil|degil|yanlış|yanlis).{0,30}(olacak|olsun|olmalı|olmali)|doğrusu|dogrusu/.test(text) ||
    (/düzelt|duzelt|değiştir|degistir/.test(text) && !/kayd|kayıt|kayit|elektrik|satış|satis|kira/.test(text))
  ) {
    const patch: Partial<KayitGirdi> = {};
    // "kart değil nakit olacak" → yeni ödeme tipi "olacak"tan ÖNCEKİ son ödeme sözcüğüdür.
    const olacakIdx = text.search(/olacak|olsun|olmalı|olmali|doğrusu|dogrusu|yerine/);
    const onceki = olacakIdx >= 0 ? text.slice(0, olacakIdx) : text;
    const sonraki = olacakIdx >= 0 ? text.slice(olacakIdx) : "";
    const oncekiOdemeler = [...onceki.matchAll(/iban|havale|eft|fast|kart|pos|nakit/gi)].map((m) => m[0]);
    const sonrakiOdemeler = [...sonraki.matchAll(/iban|havale|eft|fast|kart|pos|nakit/gi)].map((m) => m[0]);
    const yeniOdeme =
      (oncekiOdemeler.length ? detectOdeme(oncekiOdemeler[oncekiOdemeler.length - 1]) : null) ??
      (sonrakiOdemeler.length ? detectOdeme(sonrakiOdemeler[0]) : null);
    if (yeniOdeme) patch.odemeTipi = yeniOdeme;
    const duzeltAmounts = extractAmounts(text);
    const tutar = duzeltAmounts.length === 1 ? duzeltAmounts[0] : duzeltAmounts.length >= 2 ? duzeltAmounts[0] : undefined;
    if (duzeltAmounts.length >= 2) {
      const yeniTutar = duzeltAmounts[duzeltAmounts.length - 1];
      if (isIncome(text, detectKategori(text))) {
        patch.gelir = yeniTutar;
        patch.gider = 0;
      } else {
        patch.gider = yeniTutar;
        patch.gelir = 0;
      }
    }
    const kategori = detectKategori(text) ?? undefined;
    const tarih = parseDate(text, today) ?? undefined;
    const aciklamaIcerir = buildDescription(raw) || undefined;
    const sonMu = /\bson\b/.test(text);
    if (Object.keys(patch).length === 0) {
      // "düzelt" deyip neyi dememiş → sohbete değil soruya düş (uydurma kaydı engelle).
      return { type: "netlestir", mesaj: "Neyi düzelteyim? Tarihini, tutarını veya açıklamasını söyler misiniz? Örnek: 'dünkü 1500 TL elektrik kart değil nakit olacak'", confidence: 0.99 };
    }
    if (!tarih && !kategori && !aciklamaIcerir && tutar == null && !sonMu) {
      return { type: "netlestir", mesaj: "Hangi kaydı düzelteyim? Tarihini, tutarını veya açıklamasını söyler misiniz?", confidence: 0.99 };
    }
    return {
      type: "guncelle",
      filtre: { kategori, tarih, sonMu, aciklamaIcerir, tutar },
      patch,
      confidence: 0.85,
    };
  }

  if (/yap$|düzelt|duzelt|güncelle|guncelle|olarak değiştir|olarak degistir|tutarı|tutari/.test(text) && /kayd|kayıt|kayit|elektrik|satış|satis|kira/.test(text)) {    const amounts = extractAmounts(text);
    const kategori = detectKategori(text) ?? undefined;
    const tarih = parseDate(text, today) ?? undefined;
    const patch: Partial<KayitGirdi> = {};
    if (amounts.at(-1) != null) {
      const gelirMi = isIncome(text, kategori ?? null);
      if (gelirMi) {
        patch.gelir = amounts.at(-1)!;
        patch.gider = 0;
      } else {
        patch.gider = amounts.at(-1)!;
        patch.gelir = 0;
      }
    }
    const odeme = detectOdeme(text);
    if (odeme) patch.odemeTipi = odeme;
    if (kategori) patch.kategori = kategori;
    // Değişecek bir şey yoksa zorlama — Defterdar sorsun (uydurma engeli).
    if (Object.keys(patch).length === 0) {
      return { type: "netlestir", mesaj: "Neyi düzelteyim? Tarihini, tutarını veya açıklamasını söyler misiniz?", confidence: 0.99 };
    }
    return {
      type: "guncelle",
      filtre: { kategori, tarih, sonMu: /son /.test(text), aciklamaIcerir: buildDescription(raw) || undefined },
      patch,
      confidence: 0.8,
    };
  }

  const amounts = extractAmounts(text);
  // Soru soruluyorsa kayıt AÇMA ("5 bin nasıl eklerim?" → cevap ver, kayıt değil)
  if (/nasıl|nasil|neden|niçin|nicin|niye/.test(text)) {
    return { type: "sohbet", confidence: 0.2 };
  }
  // Soru cümlesi asla kayıt açmaz ("31 temmuzda ne girilmiş?" → listele)
  if (isQuestion(text)) {
    const range = parseRange(text, today);
    const tekTarih = range ? undefined : (parseDate(text, today) ?? undefined);
    if (range || tekTarih) {
      return {
        type: "listele",
        filtre: {
          baslangic: range?.baslangic ?? tekTarih,
          bitis: range?.bitis ?? tekTarih,
          kategori: detectKategori(text) ?? undefined,
          odemeTipi: detectOdeme(text) ?? undefined,
        },
        confidence: 0.85,
      };
    }
    return { type: "sohbet", confidence: 0.2 };
  }
  // Tutarsız ekleme emri ("sadece paça tamiri ekle", "deftere yaz") — tutar yoksa SOR, uydurma.
  if (/(^|[\s,.!?])(ekl[ei]|ekler|kaydet|kaydedin|gir|yaz)(?![a-zçğıöşü])/.test(text) && !/yazdır|yazdir/.test(text) && amounts.length === 0) {
    return { type: "netlestir", mesaj: "Tutarını da söyler misin? Örnek: 'Bugün 500 TL nakit paça tamiri ekle'", confidence: 0.99 };
  }
  if (amounts.length > 0 && amounts[0] > 0) {
    const tarihsizCumleler = tarihleriCikar(raw.trim())
      .split(/[.!?\n]+/)
      .map((cumle) => cumle.trim())
      .filter(Boolean);
    const kalemler = tarihsizCumleler.flatMap((cumle) => {
      const tutarlar = extractAmounts(cumle);
      if (tutarlar.length !== 1) return [];
      const kategori = detectKategori(cumle) ?? detectKategori(text) ?? "Diğer";      const gelirMi = isIncome(cumle, kategori);
      return [{
        tarih: "",
        aciklama: buildDescription(cumle) || kategori,
        kategori,
        gelir: gelirMi ? tutarlar[0] : 0,
        gider: gelirMi ? 0 : tutarlar[0],
        odemeTipi: detectOdeme(cumle) ?? detectOdeme(text) ?? "Nakit" as OdemeTipi,
      }];
    });
    if (kalemler.length >= 2) {
      const dateWasSpecified = new RegExp(
        `\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b(?:${SAYISAL_TARIH_DESENI})\\b|\\b\\d{1,2}\\s*(?:${AY_ADLARI})${AY_EKI}\\b`,
        "i",
      ).test(raw);
      const tarih = parseDate(text, today);
      if (dateWasSpecified && !tarih) {
        return { type: "netlestir", mesaj: "Tarihi netleştiremedim. Hangi güne yazmamı istersiniz?", confidence: 0.99 };
      }
      return {
        type: "ekle_coklu",
        kayitlar: kalemler.map((kalem) => ({ ...kalem, tarih: tarih ?? today })),
        confidence: 0.98,
      };
    }
    const pairedItems = /\b(?:biri|birisi)\s+.+?\s+(?:diğeri|digeri|öteki|oteki)\s+/i.test(text);
    if (pairedItems && amounts.length >= 2) {
      const dateWasSpecified = new RegExp(
        `\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b(?:${SAYISAL_TARIH_DESENI})\\b|\\b\\d{1,2}\\s*(?:${AY_ADLARI})${AY_EKI}\\b`,
      ).test(text);
      const tarih = parseDate(text, today);
      if (dateWasSpecified && !tarih) {
        return { type: "netlestir", mesaj: "Tarihi netleştiremedim. Hangi güne yazmamı istersiniz?", confidence: 0.99 };
      }
    const kategori = detectKategori(text) ?? (isIncome(text, null) ? "Hizmet" : "Diğer");
      const gelirMi = isIncome(text, kategori);
      const odemeTipi = detectOdeme(text) ?? "Nakit";
      const aciklama = buildDescription(raw) || kategori;
      return {
        type: "ekle_coklu",
        kayitlar: amounts.slice(0, 2).map((tutar) => ({
          tarih: tarih ?? today,
          aciklama,
          kategori,
          gelir: gelirMi ? tutar : 0,
          gider: gelirMi ? 0 : tutar,
          odemeTipi,
        })),
        confidence: 0.96,
      };
    }
    if (amounts.length > 1) {
      return {
        type: "netlestir",
        mesaj: `Mesajınızda ${amounts.map((amount) => amount.toLocaleString("tr-TR")).join(" ve ")} tutarları geçiyor. Yanlış kayıt açmamak için hangisinin deftere yazılacağını belirtir misiniz?`,
        confidence: 0.99,
      };
    }
    const dateWasSpecified = new RegExp(
      `\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b(?:${SAYISAL_TARIH_DESENI})\\b|\\b\\d{1,2}\\s*(?:${AY_ADLARI})${AY_EKI}\\b`,
    ).test(text);
    const parsedDate = parseDate(text, today);
    if (dateWasSpecified && !parsedDate) return { type: "sohbet", confidence: 0.2 };
    const kategori = detectKategori(text) ?? (isIncome(text, null) ? "Hizmet" : "Diğer");
    const odeme = detectOdeme(text) ?? "Nakit";
    const tarih = parsedDate ?? today;
    const gelirMi = isIncome(text, kategori);
    const amount = amounts[0];
    let aciklama = buildDescription(raw);
    if (!aciklama) aciklama = kategori;

    let not: string | undefined;
    const periyot = text.match(/(\d+)\s*ayl[ıi]k/);
    if (kategori === "Kira" && periyot) {
      const ay = Number(periyot[1]);
      const aylik = Math.round((amount / ay) * 100) / 100;
      aciklama = aciklama || `Dükkan kirası (${ay} aylık)`;
      not = `${ay} aylık kira kaydı. Aylık karşılık ${aylik.toLocaleString("tr-TR")} ₺.`;
    }

    return {
      type: "ekle",
      kayit: {
        tarih,
        aciklama: aciklama || kategori,
        kategori,
        gelir: gelirMi ? amount : 0,
        gider: gelirMi ? 0 : amount,
        odemeTipi: odeme,
      },
      confidence: 0.82,
      not,
    };
  }

  if (/kasa|rapor|özet|ozet|kar|kira|nakit|kart/.test(text)) {
    return { type: "rapor", tip: "ozet", confidence: 0.4 };
  }

  return { type: "sohbet", confidence: 0.2 };
}

export function findKayitMatches(kayitlar: Kayit[], filtre: KayitFiltresi): Kayit[] {
  let list = [...kayitlar];
  if (filtre.tarih) list = list.filter((k) => k.tarih === filtre.tarih);
  if (filtre.kategori) list = list.filter((k) => k.kategori === filtre.kategori);
  if (filtre.odemeTipi) list = list.filter((k) => k.odemeTipi === filtre.odemeTipi);
  if (filtre.tur === "gelir") list = list.filter((k) => k.gelir > 0);
  if (filtre.tur === "gider") list = list.filter((k) => k.gider > 0);
  if (filtre.aciklamaIcerir) {
    const q = trLower(filtre.aciklamaIcerir);
    list = list.filter((k) => trLower(k.aciklama).includes(q));
  }
  if (filtre.tutar != null) {
    list = list.filter((k) => Math.abs((k.gelir || k.gider) - filtre.tutar!) < 0.005);
  }
  return list.sort((a, b) => b.olusturmaZamani.localeCompare(a.olusturmaZamani));
}

export function findKayit(kayitlar: Kayit[], filtre: KayitFiltresi): Kayit | undefined {
  const matches = findKayitMatches(kayitlar, filtre);
  return filtre.sonMu ? matches[0] : matches.length === 1 ? matches[0] : undefined;
}

const GEVSEK_DISI = new Set([
  "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "için", "icin", "göre", "gore",
  "kayıt", "kayit", "kaydı", "kaydi", "kaydını", "kaydini", "son", "yeni", "eski",
]);

/**
 * Esnek adaylar: açıklama filtresi birebir tutmazsa kelime bazında puanlar.
 * Skor > 0 olanlar, önce puan sonra yenilik sırasıyla döner.
 */
export function findKayitGevsekAdaylar(kayitlar: Kayit[], filtre: KayitFiltresi): Kayit[] {
  if (!filtre.aciklamaIcerir) return [];
  const govde: KayitFiltresi = { ...filtre, aciklamaIcerir: undefined, sonMu: undefined };
  const havuz = findKayitMatches(kayitlar, govde);
  const jetonlar = trLower(filtre.aciklamaIcerir)
    .split(/[^a-zçğıöşü]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !GEVSEK_DISI.has(w));
  if (jetonlar.length === 0) return [];
  return havuz
    .map((k) => {
      const aciklama = trLower(k.aciklama);
      const skor = jetonlar.filter((j) => aciklama.includes(j)).length;
      return { k, skor };
    })
    .filter((x) => x.skor > 0)
    .sort((a, b) => b.skor - a.skor || b.k.olusturmaZamani.localeCompare(a.k.olusturmaZamani))
    .map((x) => x.k);
}

export { monthBounds as monthRange };
