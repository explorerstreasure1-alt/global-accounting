import ExcelJS from "exceljs";
import type { Ayarlar, Musteri, RaporOzet } from "./types";
import { formatDate } from "./format";
import { dilAl, kategoriEtiketi, odemeEtiketi, paraSembol } from "./rapor-dil";

const LOCALE_INTL: Record<string, { intl: string; currency: string }> = {
  tr: { intl: "tr-TR", currency: "TRY" },
  en: { intl: "en-US", currency: "USD" },
  de: { intl: "de-DE", currency: "EUR" },
  fr: { intl: "fr-FR", currency: "EUR" },
  es: { intl: "es-ES", currency: "EUR" },
  ar: { intl: "ar-SA", currency: "SAR" },
  ru: { intl: "ru-RU", currency: "RUB" },
};

/**
 * Tasarımlı Excel raporu: Kapak + Günlük + Kategoriler + Fişler.
 * Başlık stilleri, para formatı, bantlı satırlar, toplam satırları,
 * filtre + dondurulmuş başlık + baskı ayarları ile gelir.
 */

const LACI = "FF16324F";
const ALTIN = "FFF2C14E";
const ALTIN_ACIK = "FFFDEBC8";
const BANT = "FFF7F3E8";
const YESIL = "FF15803D";
const KIRMIZI = "FFB91C1C";
const PARA_FMT = '#,##0.00 "₺"';

/** Oluşturma anındaki para birimi biçimi (builder'lar senkron çalışır, yarış yok). */
let fmtAktif = PARA_FMT;

export function raporBasligi(tip: string, locale = "en"): string {
  const T: Record<string, Record<string, string>> = {
    tr: { defter: "Tam Defter Dökümü", z: "Z Raporu", gunsonu: "Gün Sonu", aysonu: "Ay Sonu", karzarar: "Kar-Zarar", ozet: "Dönem Özeti" },
    en: { defter: "Full Ledger", z: "Z Report", gunsonu: "Day Close", aysonu: "Month Close", karzarar: "Profit-Loss", ozet: "Period Summary" },
    de: { defter: "Komplettes Buch", z: "Z-Bericht", gunsonu: "Tagesschluss", aysonu: "Monatsschluss", karzarar: "Gewinn-Verlust", ozet: "Übersicht" },
    fr: { defter: "Registre complet", z: "Rapport Z", gunsonu: "Clôture jour", aysonu: "Clôture mois", karzarar: "Profit-Perte", ozet: "Résumé" },
    es: { defter: "Libro completo", z: "Informe Z", gunsonu: "Cierre día", aysonu: "Cierre mes", karzarar: "Ganancia-Pérdida", ozet: "Resumen" },
    ar: { defter: "الدفتر الكامل", z: "تقرير Z", gunsonu: "إغلاق اليوم", aysonu: "إغلاق الشهر", karzarar: "ربح-خسارة", ozet: "ملخص" },
    ru: { defter: "Полная книга", z: "Z-отчёт", gunsonu: "Закрытие дня", aysonu: "Закрытие месяца", karzarar: "Прибыль-Убыток", ozet: "Итог" },
  };
  const m = T[locale] ?? T.en;
  if (tip === "defter") return m.defter;
  if (tip === "z") return m.z;
  if (tip === "gunsonu") return m.gunsonu;
  if (tip === "aysonu") return m.aysonu;
  if (tip === "karzarar") return m.karzarar;
  return m.ozet;
}

function baslikStili(ws: ExcelJS.Worksheet, rowNo: number, colCount: number) {
  const row = ws.getRow(rowNo);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LACI } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = sinir();
  }
  row.height = 22;
}

function sinir(): Partial<ExcelJS.Borders> {
  const ince = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  return { top: ince, left: ince, bottom: ince, right: ince };
}

function tabloyuSusle(ws: ExcelJS.Worksheet, baslikSatir: number, ilkVeri: number, sonVeri: number, colCount: number) {
  baslikStili(ws, baslikSatir, colCount);
  for (let r = ilkVeri; r <= sonVeri; r += 1) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c += 1) {
      const cell = row.getCell(c);
      cell.border = sinir();
      if ((r - ilkVeri) % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BANT } };
      }
    }
  }
}

function toplamSatiri(ws: ExcelJS.Worksheet, rowNo: number, colCount: number, etiket: string) {
  const row = ws.getRow(rowNo);
  row.getCell(1).value = etiket;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALTIN_ACIK } };
    cell.font = { bold: true, size: 11 };
    cell.border = sinir();
  }
  row.height = 20;
}

function paraHucre(cell: ExcelJS.Cell, deger: number, negatifKirmizi = true) {
  cell.value = Math.round(deger * 100) / 100;
  cell.numFmt = fmtAktif;
  cell.alignment = { horizontal: "right" };
  if (negatifKirmizi) {
    cell.font = { color: { argb: deger < 0 ? KIRMIZI : "FF111111" }, bold: deger < 0 ? true : false };
  }
}

function sayfaKurulum(ws: ExcelJS.Worksheet) {
  ws.pageSetup = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

function kapakYaz(
  ws: ExcelJS.Worksheet,
  baslik: string,
  ayarlar: Ayarlar,
  rapor: RaporOzet,
  uretim: string,
  intl = "en-US",
  loc = "en",
): number {
  const fdLocal = (iso: string) => formatDate(iso, intl);
  const d = dilAl(loc);
  ws.mergeCells("A1:E1");
  const t = ws.getCell("A1");
  t.value = `${ayarlar.isletmeAdi} — ${baslik}`;
  t.font = { bold: true, size: 16, color: { argb: LACI } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:E2");
  const alt = ws.getCell("A2");
  alt.value = `${fdLocal(rapor.baslangic)} — ${fdLocal(rapor.bitis)}  •  ${uretim}`;
  alt.font = { size: 11, color: { argb: "FF555555" } };
  alt.alignment = { horizontal: "center" };

  const satirlar: Array<[string, number, boolean?]> = [
    [d.satir[0], rapor.gelir],
    [d.satir[1], rapor.gider],
    [d.satir[2], rapor.net, true],
    [d.satir[3], rapor.nakitGelir],
    [d.satir[4], rapor.nakitGider],
    [d.satir[5], rapor.nakitNet, true],
    [d.satir[6], rapor.kartGelir],
    [d.satir[7], rapor.kartGider],
    [d.satir[8], rapor.kartNet, true],
    [d.satir[9], rapor.havaleGelir],
    [d.satir[10], rapor.havaleGider],
    [d.satir[11], rapor.havaleNet, true],
    [d.satir[12], rapor.acilisBakiyesi],
    [d.satir[13], rapor.kapanisBakiyesi, true],
    [d.satir[14], rapor.adet],
  ];
  ws.getCell("A4").value = d.gosterge;
  ws.getCell("B4").value = d.tutarCol;
  baslikStili(ws, 4, 2);
  let r = 5;
  satirlar.forEach(([etiket, deger, vurgu], i) => {
    ws.getCell(`A${r}`).value = etiket;
    ws.getCell(`A${r}`).border = sinir();
    ws.getCell(`B${r}`).border = sinir();
    if (i === satirlar.length - 1) {
      ws.getCell(`B${r}`).value = deger;
      ws.getCell(`B${r}`).alignment = { horizontal: "right" };
    } else {
      paraHucre(ws.getCell(`B${r}`), deger);
    }
    if (vurgu) {
      ws.getCell(`A${r}`).font = { bold: true };
      ws.getCell(`B${r}`).font = { bold: true, color: { argb: deger < 0 ? KIRMIZI : YESIL } };
      ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALTIN_ACIK } };
      ws.getCell(`B${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALTIN_ACIK } };
    }
    r += 1;
  });
  ws.columns = [{ width: 22 }, { width: 22 }, { width: 4 }, { width: 4 }, { width: 4 }];
  sayfaKurulum(ws);
  return r;
}

export function buildExcel(
  tip: string,
  ayarlar: Ayarlar,
  rapor: RaporOzet,
  opts?: { locale?: string; currency?: string },
): ExcelJS.Workbook {
  const locale = opts?.locale ?? "en";
  const intl = LOCALE_INTL[locale]?.intl ?? "en-US";
  const d = dilAl(locale);
  fmtAktif = '#,##0.00 "' + paraSembol(opts?.currency) + '"';
  const fd = (iso: string) => formatDate(iso, intl);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tailor Ledger";
  wb.created = new Date();
  const baslik = raporBasligi(tip, locale);
  const uretim = new Date().toLocaleString(intl);

  // --- 1) Kapak / Özet ---
  const kapak = wb.addWorksheet(d.sayfaKapak);
  const ozetSon = kapakYaz(kapak, baslik, ayarlar, rapor, uretim, intl, locale);

  // --- 1b) Özet sayfasına fiş listesi (sekmeye geçmeden görünsün) ---
  const fisBaslik = ozetSon + 2;
  kapak.getCell(`A${fisBaslik}`).value = d.fisBaslik;
  kapak.getCell(`A${fisBaslik}`).font = { bold: true, size: 13, color: { argb: LACI } };
  const fisTabloBas = fisBaslik + 1;
  const fisKolonlar = d.fisKolon;
  fisKolonlar.forEach((baslikHucre, i) => {
    kapak.getCell(fisTabloBas, i + 1).value = baslikHucre;
  });
  const sirali = [...rapor.kayitlar].sort((a, b) => a.tarih.localeCompare(b.tarih));
  let fr = fisTabloBas + 1;
  for (const k of sirali) {
    kapak.getCell(fr, 1).value = fd(k.tarih);
    kapak.getCell(fr, 1).alignment = { horizontal: "center" };
    kapak.getCell(fr, 2).value = k.aciklama;
    kapak.getCell(fr, 3).value = kategoriEtiketi(k.kategori, locale);
    kapak.getCell(fr, 4).value = odemeEtiketi(k.odemeTipi, locale);
    kapak.getCell(fr, 4).alignment = { horizontal: "center" };
    paraHucre(kapak.getCell(fr, 5), k.gelir);
    paraHucre(kapak.getCell(fr, 6), k.gider);
    fr += 1;
  }
  if (sirali.length === 0) {
    kapak.getCell(fr, 1).value = d.bosFis;
    fr += 1;
  }
  kapak.addRow([]);
  toplamSatiri(kapak, fr, 6, d.toplam);
  paraHucre(kapak.getCell(fr, 5), rapor.gelir);
  paraHucre(kapak.getCell(fr, 6), rapor.gider);
  tabloyuSusle(kapak, fisTabloBas, fisTabloBas + 1, fr - 1, 6);
  kapak.columns = [
    { width: 13 },
    { width: 38 },
    { width: 14 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
  ];

  // --- 2) Günlük döküm ---
  const gun = wb.addWorksheet(d.sayfaGun);
  const gunBaslik = d.gunKolon;
  gun.addRow(gunBaslik);
  const gunIlk = 2;
  for (const gd of rapor.gunler) {
    const row = gun.addRow([
      fd(gd.tarih),
      Math.round((gd.nakitGelir - gd.nakitGider) * 100) / 100,
      Math.round((gd.kartGelir - gd.kartGider) * 100) / 100,
      Math.round((gd.havaleGelir - gd.havaleGider) * 100) / 100,
      gd.gelir,
      gd.gider,
      gd.net,
      gd.net > 0 ? "▲" : gd.net < 0 ? "▼" : "■",
      gd.adet,
    ]);
    for (const c of [2, 3, 4, 5, 6, 7]) {
      const cell = row.getCell(c);
      cell.numFmt = PARA_FMT;
      cell.alignment = { horizontal: "right" };
    }
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(8).alignment = { horizontal: "center" };
    row.getCell(8).font = {
      bold: true,
      color: { argb: gd.net > 0 ? YESIL : gd.net < 0 ? KIRMIZI : "FF888888" },
    };
    row.getCell(9).alignment = { horizontal: "center" };
  }
  if (rapor.gunler.length === 0) {
    gun.addRow([d.bosGun, "", "", "", "", "", "", "", ""]);
  }
  const gunTop = gun.rowCount + 1;
  gun.addRow([d.toplam, "", "", "", "", "", "", "", ""]);
  toplamSatiri(gun, gunTop, 9, d.toplam);
  paraHucre(gun.getCell(`B${gunTop}`), rapor.nakitNet);
  paraHucre(gun.getCell(`C${gunTop}`), rapor.kartNet);
  paraHucre(gun.getCell(`D${gunTop}`), rapor.havaleNet);
  paraHucre(gun.getCell(`E${gunTop}`), rapor.gelir);
  paraHucre(gun.getCell(`F${gunTop}`), rapor.gider);
  paraHucre(gun.getCell(`G${gunTop}`), rapor.net);
  gun.getCell(`I${gunTop}`).value = rapor.adet;
  gun.getCell(`I${gunTop}`).alignment = { horizontal: "center" };
  tabloyuSusle(gun, 1, gunIlk, gunTop - 1, 9);
  gun.columns = [
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 8 },
    { width: 8 },
  ];
  gun.autoFilter = { from: "A1", to: `I${gunTop - 1}` };
  gun.views = [{ state: "frozen", ySplit: 1 }];
  sayfaKurulum(gun);

  // --- 3) Kategoriler ---
  const kat = wb.addWorksheet(d.sayfaKat);
  kat.addRow(d.katKolon);
  const katIlk = 2;
  const topGider = rapor.kategoriler.reduce((s, k) => s + k.gider, 0);
  for (const k of rapor.kategoriler) {
    const row = kat.addRow([
      kategoriEtiketi(k.kategori, locale),
      k.adet,
      k.gelir,
      k.gider,
      k.net,
      topGider > 0 ? Math.round((k.gider / topGider) * 1000) / 10 : 0,
    ]);
    for (const c of [3, 4, 5]) {
      row.getCell(c).numFmt = PARA_FMT;
      row.getCell(c).alignment = { horizontal: "right" };
    }
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(6).numFmt = '0.0"%"';
    row.getCell(6).alignment = { horizontal: "right" };
  }
  const katTop = kat.rowCount + 1;
  kat.addRow([d.toplam, "", "", "", "", ""]);
  toplamSatiri(kat, katTop, 6, d.toplam);
  kat.getCell(`B${katTop}`).value = rapor.adet;
  kat.getCell(`B${katTop}`).alignment = { horizontal: "center" };
  paraHucre(kat.getCell(`C${katTop}`), rapor.gelir);
  paraHucre(kat.getCell(`D${katTop}`), rapor.gider);
  paraHucre(kat.getCell(`F${katTop}`), 0);
  kat.getCell(`F${katTop}`).value = topGider > 0 ? 100 : 0;
  kat.getCell(`F${katTop}`).numFmt = '0.0"%"';
  paraHucre(kat.getCell(`E${katTop}`), rapor.net);
  tabloyuSusle(kat, 1, katIlk, katTop - 1, 6);
  kat.columns = [{ width: 18 }, { width: 10 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 13 }];
  kat.autoFilter = { from: "A1", to: `F${katTop - 1}` };
  kat.views = [{ state: "frozen", ySplit: 1 }];
  sayfaKurulum(kat);

  // --- 4) Fişler ---
  const fis = wb.addWorksheet(d.sayfaFis);
  fis.addRow(d.fisKolon);
  const fisIlk = 2;
  for (const k of rapor.kayitlar) {
    const row = fis.addRow([fd(k.tarih), k.aciklama, kategoriEtiketi(k.kategori, locale), odemeEtiketi(k.odemeTipi, locale), k.gelir, k.gider]);
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    for (const c of [5, 6]) {
      const cell = row.getCell(c);
      cell.numFmt = PARA_FMT;
      cell.alignment = { horizontal: "right" };
      if (Number(cell.value) === 0) cell.font = { color: { argb: "FFBBBBBB" } };
    }
  }
  if (rapor.kayitlar.length === 0) {
    fis.addRow([d.bosFis, "", "", "", "", ""]);
  }
  const fisTop = fis.rowCount + 1;
  fis.addRow([d.toplam, "", "", "", "", ""]);
  toplamSatiri(fis, fisTop, 6, d.toplam);
  paraHucre(fis.getCell(`E${fisTop}`), rapor.gelir);
  paraHucre(fis.getCell(`F${fisTop}`), rapor.gider);
  tabloyuSusle(fis, 1, fisIlk, fisTop - 1, 6);
  fis.columns = [{ width: 13 }, { width: 38 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 16 }];
  fis.autoFilter = { from: "A1", to: `F${fisTop - 1}` };
  fis.views = [{ state: "frozen", ySplit: 1 }];
  sayfaKurulum(fis);

  return wb;
}

/** Müşteri listesi: kart, ziyaret, harcama ve veresiye borcuyla tek sayfa. */
export function buildMusteriExcel(
  musteriler: Musteri[],
  opts?: { locale?: string; currency?: string; isletmeAdi?: string },
): ExcelJS.Workbook {
  const locale = opts?.locale ?? "en";
  const T: Record<string, { baslik: string; kolonlar: string[] }> = {
    tr: { baslik: "Müşteriler", kolonlar: ["Ad", "Soyad", "Telefon", "Ziyaret", "Toplam", "Borç", "Son ziyaret", "Son hizmet", "Not"] },
    en: { baslik: "Customers", kolonlar: ["First name", "Last name", "Phone", "Visits", "Total", "Debt", "Last visit", "Last service", "Note"] },
    de: { baslik: "Kunden", kolonlar: ["Vorname", "Nachname", "Telefon", "Besuche", "Gesamt", "Schulden", "Letzter Besuch", "Letzte Leistung", "Notiz"] },
    fr: { baslik: "Clients", kolonlar: ["Prénom", "Nom", "Téléphone", "Visites", "Total", "Dette", "Dernière visite", "Dernier service", "Note"] },
    es: { baslik: "Clientes", kolonlar: ["Nombre", "Apellido", "Teléfono", "Visitas", "Total", "Deuda", "Última visita", "Último servicio", "Nota"] },
    ar: { baslik: "العملاء", kolonlar: ["الاسم", "اللقب", "الهاتف", "الزيارات", "الإجمالي", "الدين", "آخر زيارة", "آخر خدمة", "ملاحظة"] },
    ru: { baslik: "Клиенты", kolonlar: ["Имя", "Фамилия", "Телефон", "Визиты", "Итого", "Долг", "Посл. визит", "Посл. услуга", "Заметка"] },
  };
  const m = T[locale] ?? T.en;
  fmtAktif = '#,##0.00 "' + paraSembol(opts?.currency) + '"';
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tailor Ledger";
  wb.created = new Date();
  const ws = wb.addWorksheet(m.baslik.slice(0, 31));
  ws.mergeCells("A1:I1");
  const t = ws.getCell("A1");
  t.value = `${opts?.isletmeAdi || "Shop"} — ${m.baslik}`;
  t.font = { bold: true, size: 16, color: { argb: LACI } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;
  ws.addRow(m.kolonlar);
  const ilk = 3;
  const sirali = [...musteriler].sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`));
  for (const u of sirali) {
    const row = ws.addRow([u.ad, u.soyad, u.telefon, u.ziyaretSayisi, u.toplamHarcama, u.borc ?? 0, u.sonZiyaret ?? "", u.sonHizmet ?? "", u.not]);
    row.getCell(4).alignment = { horizontal: "center" };
    paraHucre(row.getCell(5), u.toplamHarcama, false);
    paraHucre(row.getCell(6), u.borc ?? 0, false);
  }
  if (sirali.length === 0) {
    ws.addRow(["—", "", "", "", "", "", "", "", ""]);
  }
  const top = ws.rowCount + 1;
  ws.addRow(["", "", "", "", "", "", "", "", ""]);
  toplamSatiri(ws, top, 9, m.kolonlar[4]);
  const topHarcama = sirali.reduce((s, u) => s + u.toplamHarcama, 0);
  const topBorc = sirali.reduce((s, u) => s + (u.borc ?? 0), 0);
  paraHucre(ws.getCell(`E${top}`), topHarcama, false);
  paraHucre(ws.getCell(`F${top}`), topBorc, false);
  tabloyuSusle(ws, 2, ilk, top - 1, 9);
  ws.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 24 }, { width: 30 }];
  ws.autoFilter = { from: "A2", to: `I${top - 1}` };
  ws.views = [{ state: "frozen", ySplit: 2 }];
  sayfaKurulum(ws);
  return wb;
}
