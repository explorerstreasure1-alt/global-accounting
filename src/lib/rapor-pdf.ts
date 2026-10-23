import { promises as fs } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import type { Ayarlar, RaporOzet } from "./types";
import { formatMoneyLocale, formatDate } from "./format";
import { dilAl, kategoriEtiketi, odemeEtiketi } from "./rapor-dil";

const LOCALE_INTL: Record<string, { intl: string; currency: string }> = {
  tr: { intl: "tr-TR", currency: "TRY" },
  en: { intl: "en-US", currency: "USD" },
  de: { intl: "de-DE", currency: "EUR" },
  fr: { intl: "fr-FR", currency: "EUR" },
  es: { intl: "es-ES", currency: "EUR" },
  ar: { intl: "ar-SA", currency: "SAR" },
  ru: { intl: "ru-RU", currency: "RUB" },
  fa: { intl: "fa-IR", currency: "IRR" },
  he: { intl: "he-IL", currency: "ILS" },
  ku: { intl: "ku-TR", currency: "TRY" },
};

/**
 * Sunucu tarafı vektör PDF: Türkçe sorunsuz (Arial gömülü), satır asla
 * sayfada bölünmez (her satır öncesi sayfa kontrolü), metin seçilebilir.
 */

const SOLUK: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [15, 23, 42];
const CIZGI: [number, number, number] = [226, 217, 195];
const LACI: [number, number, number] = [22, 50, 79];
const YESIL: [number, number, number] = [21, 128, 61];
const KIRMIZI: [number, number, number] = [185, 28, 28];
const BANT: [number, number, number] = [247, 243, 232];

let fontCache: { normal: string; bold: string } | null = null;

async function fontlariYukle(): Promise<{ normal: string; bold: string }> {
  if (fontCache) return fontCache;
  const kok = process.env.SystemRoot || "C:\\Windows";
  const normal = await fs.readFile(path.join(kok, "Fonts", "arial.ttf"));
  const bold = await fs.readFile(path.join(kok, "Fonts", "arialbd.ttf"));
  fontCache = { normal: normal.toString("base64"), bold: bold.toString("base64") };
  return fontCache;
}

function yeniSayfaGerekirse(doc: jsPDF, y: number, gereken: number): number {
  if (y + gereken > 282) {
    doc.addPage();
    return 16;
  }
  return y;
}

function tabloBasligi(doc: jsPDF, y: number, sutunlar: Array<{ x: number; yazi: string }>): void {
  doc.setFont("arial", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SOLUK);
  for (const s of sutunlar) doc.text(s.yazi, s.x, y);
}

export async function raporPdfUret(
  rapor: RaporOzet,
  ayarlar: Ayarlar,
  baslik: string,
  damga: string,
  opts?: { locale?: string; currency?: string },
): Promise<Buffer> {
  const loc = opts?.locale ?? "en";
  const intl = LOCALE_INTL[loc]?.intl ?? "en-US";
  const currency = opts?.currency ?? LOCALE_INTL[loc]?.currency ?? "USD";
  const d = dilAl(loc);
  const fm = (v: number, sym = true) => formatMoneyLocale(v, intl, currency, sym);
  const fd = (iso: string) => formatDate(iso, intl);
  const fontlar = await fontlariYukle();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.addFileToVFS("arial.ttf", fontlar.normal);
  doc.addFileToVFS("arialbd.ttf", fontlar.bold);
  doc.addFont("arial.ttf", "arial", "normal");
  doc.addFont("arialbd.ttf", "arial", "bold");

  const GENIS = 186;
  const SOL = 12;
  let y = 14;

  // Başlık
  doc.setFont("arial", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...LACI);
  doc.text(ayarlar.isletmeAdi, SOL, y);
  const damgaW = doc.getTextWidth(damga) + 10;
  doc.setDrawColor(...LACI);
  doc.setLineWidth(0.6);
  doc.rect(SOL + GENIS - damgaW, y - 7, damgaW, 9);
  doc.setFontSize(10);
  doc.text(damga, SOL + GENIS - damgaW + 5, y - 1.5);
  y += 7;
  doc.setFont("arial", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SOLUK);
  doc.text(`${baslik.toLocaleUpperCase(intl)}  •  ${fd(rapor.baslangic)} — ${fd(rapor.bitis)}`, SOL, y);
  y += 4;
  doc.setDrawColor(...CIZGI);
  doc.setLineWidth(0.4);
  doc.line(SOL, y, SOL + GENIS, y);
  y += 7;

  // Özet kutuları (4 sütun)
  const k = d.kutu;
  const kutular: Array<[string, string, boolean?]> = [
    [k[0], fm(rapor.nakitGelir)],
    [k[1], fm(rapor.nakitGider)],
    [k[2], fm(rapor.kartGelir)],
    [k[3], fm(rapor.kartGider)],
    [k[4], fm(rapor.havaleGelir)],
    [k[5], fm(rapor.havaleGider)],
    [k[6], fm(rapor.nakitNet), true],
    [k[7], fm(rapor.kartNet), true],
    [k[8], fm(rapor.havaleNet), true],
    [k[9], fm(rapor.gelir)],
    [k[10], fm(rapor.gider)],
    [d.kayitSayi(rapor.adet), fm(rapor.net, false)],
  ];
  const sutun = 4;
  const kutuW = (GENIS - (sutun - 1) * 3) / sutun;
  kutular.forEach(([etiket, deger, vurgu], i) => {
    const cx = SOL + (i % sutun) * (kutuW + 3);
    const cy = y + Math.floor(i / sutun) * 17;
    doc.setDrawColor(...CIZGI);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, kutuW, 14, 2, 2);
    doc.setFont("arial", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SOLUK);
    doc.text(etiket.toLocaleUpperCase(intl), cx + 2, cy + 5);
    doc.setFont("arial", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...(vurgu ? YESIL : INK));
    doc.text(deger, cx + 2, cy + 10.5);
  });
  y += Math.ceil(kutular.length / sutun) * 17 + 3;

  // Net şeridi
  const serit: Array<[string, string, [number, number, number]]> = [
    [d.serit[0], fm(rapor.net), rapor.net >= 0 ? YESIL : KIRMIZI],
    [d.serit[1], fm(rapor.acilisBakiyesi), INK],
    [d.serit[2], fm(rapor.kapanisBakiyesi), LACI],
  ];
  {
    const sw = (GENIS - 6) / 3;
    serit.forEach(([etiket, deger, renk], i) => {
      const cx = SOL + i * (sw + 3);
      doc.setDrawColor(...renk);
      doc.setLineWidth(0.6);
      doc.roundedRect(cx, y, sw, 16, 2, 2);
      doc.setFont("arial", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...SOLUK);
      doc.text(etiket, cx + 3, y + 5.5);
      doc.setFont("arial", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...renk);
      doc.text(deger, cx + 3, y + 11.5);
    });
    y += 20;
  }

  // Kategoriler
  const kats = [...rapor.kategoriler]
    .sort((a, b) => b.gelir + b.gider - (a.gelir + a.gider))
    .slice(0, 8);
  if (kats.length) {
    y = yeniSayfaGerekirse(doc, y, 12);
    doc.setFont("arial", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(d.katSec, SOL, y);
    y += 6;
    const maxKat = Math.max(1, ...kats.map((k) => k.gelir + k.gider));
    doc.setFont("arial", "normal");
    doc.setFontSize(9);
    for (const k of kats) {
      y = yeniSayfaGerekirse(doc, y, 8);
      doc.setTextColor(...INK);
      doc.text(`${kategoriEtiketi(k.kategori, loc)} · ${d.kayitSayi(k.adet)}`, SOL, y);
      const barX = SOL + 62;
      const barW = 72;
      doc.setFillColor(...BANT);
      doc.rect(barX, y - 3.4, barW, 4.6, "F");
      doc.setFillColor(...LACI);
      doc.rect(barX, y - 3.4, Math.max(2, (barW * (k.gelir + k.gider)) / maxKat), 4.6, "F");
      doc.setFont("arial", "bold");
      doc.text(fm(k.net, false), barX + barW + 4, y);
      doc.setFont("arial", "normal");
      y += 7;
    }
    y += 2;
  }

  // Günlük netler
  const gunler = rapor.gunler.slice(-20);
  if (gunler.length) {
    y = yeniSayfaGerekirse(doc, y, 12);
    doc.setFont("arial", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(d.gunSec, SOL, y);
    y += 6;
    const maxGun = Math.max(1, ...gunler.map((g) => Math.abs(g.net)));
    doc.setFont("arial", "normal");
    doc.setFontSize(9);
    for (const g of gunler) {
      y = yeniSayfaGerekirse(doc, y, 7);
      doc.setTextColor(...SOLUK);
      doc.text(fd(g.tarih).slice(0, 5), SOL, y);
      const barX = SOL + 22;
      const barW = 110;
      doc.setFillColor(...BANT);
      doc.rect(barX, y - 3.2, barW, 4.2, "F");
      doc.setFillColor(...(g.net >= 0 ? YESIL : KIRMIZI));
      doc.rect(barX, y - 3.2, Math.max(2, (barW * Math.abs(g.net)) / maxGun), 4.2, "F");
      doc.setFont("arial", "bold");
      doc.setTextColor(...INK);
      doc.text(fm(g.net, false), barX + barW + 4, y);
      doc.setFont("arial", "normal");
      y += 6.5;
    }
    y += 2;
  }

  // Fiş listesi
  y = yeniSayfaGerekirse(doc, y, 14);
  doc.setFont("arial", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(d.fisSayi(rapor.kayitlar.length), SOL, y);
  y += 6;
  const fisBaslik = () => tabloBasligi(doc, y, [
    { x: SOL, yazi: d.fisKolon[0] },
    { x: SOL + 24, yazi: d.fisKolon[1] },
    { x: SOL + 108, yazi: d.fisKolon[2] },
    { x: SOL + 138, yazi: d.fisKolon[3] },
    { x: SOL + 186, yazi: d.tutarCol },
  ]);
  fisBaslik();
  y += 5;
  doc.setFont("arial", "normal");
  doc.setFontSize(9);
  const sirali = [...rapor.kayitlar].sort((a, b) => a.tarih.localeCompare(b.tarih));
  for (const k of sirali) {
    y = yeniSayfaGerekirse(doc, y, 6);
    // Yeni sayfaya geçildiyse başlığı tekrarla
    if (y === 16) {
      fisBaslik();
      y += 5;
      doc.setFont("arial", "normal");
      doc.setFontSize(9);
    }
    doc.setTextColor(...SOLUK);
    doc.text(fd(k.tarih), SOL, y);
    doc.setTextColor(...INK);
    const aciklama = k.aciklama.length > 42 ? `${k.aciklama.slice(0, 41)}…` : k.aciklama;
    doc.text(aciklama, SOL + 24, y);
    doc.text(kategoriEtiketi(k.kategori, loc), SOL + 108, y);
    doc.text(odemeEtiketi(k.odemeTipi, loc), SOL + 138, y);
    doc.setFont("arial", "bold");
    doc.text(fm(k.gelir || k.gider), SOL + 186, y, { align: "right" });
    doc.setFont("arial", "normal");
    y += 5.6;
  }
  y += 3;
  // Alt toplam
  y = yeniSayfaGerekirse(doc, y, 26);
  doc.setFont("arial", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(d.altToplam, SOL, y);
  y += 6;
  doc.setFont("arial", "normal");
  doc.setFontSize(9.5);
  const toplamlar = [
    `${d.topNakit}: ${fm(rapor.nakitNet)}   (${d.gelirW} ${fm(rapor.nakitGelir)} – ${d.giderW} ${fm(rapor.nakitGider)})`,
    `${d.topKart}: ${fm(rapor.kartNet)}   (${d.gelirW} ${fm(rapor.kartGelir)} – ${d.giderW} ${fm(rapor.kartGider)})`,
    `${d.topHavale}: ${fm(rapor.havaleNet)}   (${d.gelirW} ${fm(rapor.havaleGelir)} – ${d.giderW} ${fm(rapor.havaleGider)})`,
    `${d.topGenel}: ${fm(rapor.net)}`,
  ];
  for (const satir of toplamlar) {
    doc.text(satir, SOL, y);
    y += 5.5;
  }

  // Altbilgi + sayfa numaraları
  const sayfaSayisi = doc.getNumberOfPages();
  const simdi = new Date().toLocaleString(intl);
  for (let i = 1; i <= sayfaSayisi; i += 1) {
    doc.setPage(i);
    doc.setFont("arial", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SOLUK);
    doc.text(`${ayarlar.isletmeAdi} · ${d.footerOrta} · ${simdi}`, SOL, 290);
    doc.text(`${i} / ${sayfaSayisi}`, SOL + GENIS, 290, { align: "right" });
  }

  const cikti = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(cikti);
}
