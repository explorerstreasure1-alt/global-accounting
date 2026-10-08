import type { Kategori } from "./types";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

export function formatTRDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function formatTRDateLong(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function monthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export function monthPrefix(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function formatMoney(value: number, withSymbol = true): string {
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  return withSymbol ? `${formatted} ₺` : formatted;
}

export function formatMoneySigned(value: number): string {
  const abs = formatMoney(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

export function parseTurkishNumber(raw: string): number | null {
  let s = raw.trim().replace(/[₺\s]/g, "").replace(/tl/gi, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function trLower(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

/** Terzi dükkânında sık geçen sözcüklerin doğru yazımı (sesli yazım hataları için). */
const ACIKLAMA_SOZLUK: Array<[RegExp, string]> = [
  [/\bfermar\b/gi, "fermuar"],
  [/\bpaca\b/gi, "paça"],
  [/\babi\b/gi, "abiye"],
  [/\bhapiye\b/gi, "abiye"],
  [/\babıye\b/gi, "abiye"],
  [/\byikama\b/gi, "yıkama"],
  [/\bütü\b/gi, "ütü"],
  [/\bkurutemizleme\b/gi, "kuru temizleme"],
  [/\bkisaltma\b/gi, "kısaltma"],
  [/\btadılat\b/gi, "tadilat"],
  [/\bdikis\b/gi, "dikiş"],
  [/\bdikimi\b/gi, "dikimi"],
  [/\bkumas\b/gi, "kumaş"],
  [/\bcicek\b/gi, "çiçek"],
  [/\bgomlek\b/gi, "gömlek"],
  [/\bpantolon\b/gi, "pantolon"],
  [/\betek\b/gi, "etek"],
  [/\bceket\b/gi, "ceket"],
  [/\bperde\b/gi, "perde"],
  [/\bgelinlik\b/gi, "gelinlik"],
  [/\bdamatlık\b/gi, "damatlık"],
];

/**
 * Açıklamayı Excel'e yakışır hale getirir: boşlukları toparlar, bilinen
 * yazım yanlışlarını düzeltir, ilk harfi büyütür. Anlam EKLEMEZ.
 */
export function duzeltAciklama(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  for (const [kalip, dogru] of ACIKLAMA_SOZLUK) {
    kalip.lastIndex = 0;
    s = s.replace(kalip, dogru);
  }
  // Cümle düzeni: ilk harf büyük, gerisi küçük (kısaltma/tutar zaten ayıklandı).
  const kucuk = s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
  return kucuk.charAt(0).toLocaleUpperCase("tr-TR") + kucuk.slice(1);
}

export function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const KATEGORI_RENK: Record<Kategori, string> = {
  Kira: "#9a3412",
  Elektrik: "#b45309",
  Su: "#1d4ed8",
  Doğalgaz: "#7c3aed",
  Ev: "#be185d",
  "İş Yeri": "#0f766e",
  Hizmet: "#15803d",
  Market: "#c2410c",
  Diğer: "#334155",
};

export const AYLAR = [
  "ocak",
  "şubat",
  "mart",
  "nisan",
  "mayıs",
  "haziran",
  "temmuz",
  "ağustos",
  "eylül",
  "ekim",
  "kasım",
  "aralık",
];
