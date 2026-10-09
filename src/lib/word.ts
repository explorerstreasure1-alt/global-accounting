import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import type { Ayarlar, RaporOzet } from "./types";
import { formatDate, formatMoneyLocale } from "./format";

const LOCALE_INTL: Record<string, { intl: string; currency: string }> = {
  tr: { intl: "tr-TR", currency: "TRY" },
  en: { intl: "en-US", currency: "USD" },
  de: { intl: "de-DE", currency: "EUR" },
  fr: { intl: "fr-FR", currency: "EUR" },
  es: { intl: "es-ES", currency: "EUR" },
  ar: { intl: "ar-SA", currency: "SAR" },
  ru: { intl: "ru-RU", currency: "RUB" },
};

const L: Record<string, Record<string, string>> = {
  tr: { summary: "Özet", daily: "Günlük döküm", receipts: "Fiş listesi", date: "Tarih", cash: "Nakit", card: "Kart", transfer: "Havale", income: "Gelir", expense: "Gider", net: "Net", totalIn: "Toplam Gelir", totalEx: "Toplam Gider", grandNet: "Genel Net", opening: "Açılış", closing: "Kapanış", count: "Kayıt", desc: "Açıklama", cat: "Kategori", pay: "Ödeme", prepared: "hazırlandı" },
  en: { summary: "Summary", daily: "Daily breakdown", receipts: "Receipt list", date: "Date", cash: "Cash", card: "Card", transfer: "Transfer", income: "Income", expense: "Expense", net: "Net", totalIn: "Total Income", totalEx: "Total Expense", grandNet: "Grand Net", opening: "Opening", closing: "Closing", count: "Records", desc: "Description", cat: "Category", pay: "Payment", prepared: "prepared" },
  de: { summary: "Übersicht", daily: "Tagesaufstellung", receipts: "Belegliste", date: "Datum", cash: "Bar", card: "Karte", transfer: "Überweisung", income: "Einnahmen", expense: "Ausgaben", net: "Netto", totalIn: "Gesamteinnahmen", totalEx: "Gesamtausgaben", grandNet: "Gesamt-Netto", opening: "Eröffnung", closing: "Schluss", count: "Einträge", desc: "Beschreibung", cat: "Kategorie", pay: "Zahlung", prepared: "erstellt" },
  fr: { summary: "Résumé", daily: "Détail journalier", receipts: "Liste reçus", date: "Date", cash: "Espèces", card: "Carte", transfer: "Virement", income: "Revenus", expense: "Dépenses", net: "Net", totalIn: "Revenus totaux", totalEx: "Dépenses totales", grandNet: "Net général", opening: "Ouverture", closing: "Clôture", count: "Lignes", desc: "Description", cat: "Catégorie", pay: "Paiement", prepared: "préparé" },
  es: { summary: "Resumen", daily: "Desglose diario", receipts: "Lista recibos", date: "Fecha", cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", income: "Ingresos", expense: "Gastos", net: "Neto", totalIn: "Ingresos totales", totalEx: "Gastos totales", grandNet: "Neto general", opening: "Apertura", closing: "Cierre", count: "Líneas", desc: "Descripción", cat: "Categoría", pay: "Pago", prepared: "preparado" },
  ar: { summary: "ملخص", daily: "تفصيل يومي", receipts: "قائمة الإيصالات", date: "التاريخ", cash: "نقد", card: "بطاقة", transfer: "تحويل", income: "الدخل", expense: "المصروف", net: "الصافي", totalIn: "إجمالي الدخل", totalEx: "إجمالي المصروف", grandNet: "الصافي العام", opening: "افتتاحي", closing: "ختامي", count: "سجلات", desc: "الوصف", cat: "الفئة", pay: "الدفع", prepared: "أُعد" },
  ru: { summary: "Итог", daily: "По дням", receipts: "Чеки", date: "Дата", cash: "Нал", card: "Карта", transfer: "Перевод", income: "Доход", expense: "Расход", net: "Нетто", totalIn: "Всего доход", totalEx: "Всего расход", grandNet: "Итого нетто", opening: "Начало", closing: "Конец", count: "Записи", desc: "Описание", cat: "Категория", pay: "Оплата", prepared: "подготовлен" },
};

export function wordBasligi(tip: string, locale = "en"): string {
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
  return m[tip] ?? m.ozet;
}

function row(cells: string[], bold = false): TableRow {
  return new TableRow({
    children: cells.map(
      (c) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c, bold })] })],
        }),
    ),
  });
}

export async function buildWord(
  tip: string,
  ayarlar: Ayarlar,
  rapor: RaporOzet,
  opts?: { locale?: string; currency?: string },
): Promise<Buffer> {
  const locale = opts?.locale ?? "en";
  const meta = LOCALE_INTL[locale] ?? LOCALE_INTL.en;
  const t = L[locale] ?? L.en;
  const fm = (v: number) => formatMoneyLocale(v, meta.intl, opts?.currency ?? meta.currency);
  const fd = (iso: string) => formatDate(iso, meta.intl);
  const baslik = wordBasligi(tip, locale);

  const ozet: Array<[string, string]> = [
    [t.totalIn, fm(rapor.gelir)],
    [t.totalEx, fm(rapor.gider)],
    [t.grandNet, fm(rapor.net)],
    [`${t.cash} ${t.income}`, fm(rapor.nakitGelir)],
    [`${t.cash} ${t.expense}`, fm(rapor.nakitGider)],
    [`${t.cash} ${t.net}`, fm(rapor.nakitNet)],
    [`${t.card} ${t.income}`, fm(rapor.kartGelir)],
    [`${t.card} ${t.expense}`, fm(rapor.kartGider)],
    [`${t.card} ${t.net}`, fm(rapor.kartNet)],
    [`${t.transfer} ${t.income}`, fm(rapor.havaleGelir)],
    [`${t.transfer} ${t.expense}`, fm(rapor.havaleGider)],
    [`${t.transfer} ${t.net}`, fm(rapor.havaleNet)],
    [t.opening, fm(rapor.acilisBakiyesi)],
    [t.closing, fm(rapor.kapanisBakiyesi)],
    [t.count, String(rapor.adet)],
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: `${ayarlar.isletmeAdi} — ${baslik}`, heading: HeadingLevel.TITLE }),
          new Paragraph({
            text: `${fd(rapor.baslangic)} — ${fd(rapor.bitis)}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: t.summary, heading: HeadingLevel.HEADING_1 }),
          new Table({ rows: ozet.map(([k, v]) => row([k, v])) }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: t.daily, heading: HeadingLevel.HEADING_1 }),
          new Table({
            rows: [
              row([t.date, t.cash, t.card, t.transfer, t.income, t.expense, t.net], true),
              ...rapor.gunler.map((g) =>
                row([
                  fd(g.tarih),
                  fm(g.nakitGelir - g.nakitGider),
                  fm(g.kartGelir - g.kartGider),
                  fm(g.havaleGelir - g.havaleGider),
                  fm(g.gelir),
                  fm(g.gider),
                  fm(g.net),
                ]),
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: t.receipts, heading: HeadingLevel.HEADING_1 }),
          new Table({
            rows: [
              row([t.date, t.desc, t.cat, t.pay, t.income, t.expense], true),
              ...[...rapor.kayitlar]
                .sort((a, b) => a.tarih.localeCompare(b.tarih))
                .map((k) =>
                  row([fd(k.tarih), k.aciklama, k.kategori, k.odemeTipi, k.gelir ? fm(k.gelir) : "—", k.gider ? fm(k.gider) : "—"]),
                ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: `${ayarlar.isletmeAdi} · ${t.prepared} ${new Date().toLocaleString(meta.intl)}`,
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
