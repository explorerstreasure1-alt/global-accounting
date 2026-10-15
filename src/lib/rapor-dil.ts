/**
 * Rapor çıktılarının (Excel / JPG / PDF / Word) ortak dil tablosu.
 * Tüm kullanıcı metinleri seçili dile göre buradan gelir; ham veri
 * (kategori, ödeme tipi) de burada yerelleştirilir.
 */

export type RaporMetin = {
  sayfaKapak: string;
  sayfaGun: string;
  sayfaKat: string;
  sayfaFis: string;
  fisBaslik: string;
  fisKolon: [string, string, string, string, string, string];
  gunKolon: [string, string, string, string, string, string, string, string, string];
  katKolon: [string, string, string, string, string, string];
  toplam: string;
  bosFis: string;
  bosGun: string;
  gosterge: string;
  tutarCol: string;
  satir: [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
  kutu: [string, string, string, string, string, string, string, string, string, string, string, string];
  serit: [string, string, string];
  katSec: string;
  gunSec: string;
  fisSec: string;
  thead: [string, string, string];
  kayitTekil: string;
  topNakit: string;
  topKart: string;
  topHavale: string;
  topGenel: string;
  gelirW: string;
  giderW: string;
  altToplam: string;
  footerOrta: string;
  ektedir: string;
  fisSayi: (n: number) => string;
  dahaFazla: (n: number) => string;
  kayitSayi: (n: number) => string;
};

const TR: RaporMetin = {
  sayfaKapak: "Özet", sayfaGun: "Günlük Döküm", sayfaKat: "Kategoriler", sayfaFis: "Fişler",
  fisBaslik: "Fiş Listesi (ödeme tipiyle)",
  fisKolon: ["Tarih", "Açıklama", "Kategori", "Ödeme", "Gelir", "Gider"],
  gunKolon: ["Tarih", "Nakit Net", "Kart Net", "Havale Net", "Gelir", "Gider", "Net", "Durum", "Adet"],
  katKolon: ["Kategori", "Adet", "Gelir", "Gider", "Net", "Gider Payı %"],
  toplam: "TOPLAM", bosFis: "Bu aralıkta fiş yok.", bosGun: "Bu aralıkta kayıt yok.",
  gosterge: "Gösterge", tutarCol: "Tutar",
  satir: ["Toplam Gelir", "Toplam Gider", "GENEL NET", "Nakit Gelir", "Nakit Gider", "Nakit Net", "Kart Gelir", "Kart Gider", "Kart Net", "Havale Gelir", "Havale Gider", "Havale Net", "Açılış Bakiyesi", "Kapanış Bakiyesi", "İşlem Adedi"],
  kutu: ["Nakit Gelir", "Nakit Gider", "Kart Gelir", "Kart Gider", "Havale Gelir", "Havale Gider", "Nakit Net", "Kart Net", "Havale Net", "Toplam Gelir", "Toplam Gider", "Toplam Gelir"],
  serit: ["GENEL NET", "AÇILIŞ", "KAPANIŞ"],
  katSec: "Kategoriler", gunSec: "Günlük net", fisSec: "Fiş listesi",
  thead: ["TARİH", "AÇIKLAMA", "TUTAR"],
  kayitTekil: "kayıt", footerOrta: "Defterdar ile hazırlandı", ektedir: "dosya ektedir.",
  fisSayi: (n) => `Fiş listesi (${n} kayıt)`,
  dahaFazla: (n) => `… ve ${n} kayıt daha (tümü Excel'de)`,
  kayitSayi: (n) => `${n} kayıt`,
  topNakit: "Nakit toplam", topKart: "Kart toplamı", topHavale: "Havale toplamı", topGenel: "GENEL TOPLAM",
  gelirW: "gelir", giderW: "gider", altToplam: "Alt toplam",
};

const EN: RaporMetin = {
  sayfaKapak: "Summary", sayfaGun: "Daily", sayfaKat: "Categories", sayfaFis: "Receipts",
  fisBaslik: "Receipt list (by payment)",
  fisKolon: ["Date", "Description", "Category", "Payment", "Income", "Expense"],
  gunKolon: ["Date", "Cash Net", "Card Net", "Transfer Net", "Income", "Expense", "Net", "Trend", "Count"],
  katKolon: ["Category", "Count", "Income", "Expense", "Net", "Expense %"],
  toplam: "TOTAL", bosFis: "No receipts in range.", bosGun: "No records in range.",
  gosterge: "Metric", tutarCol: "Amount",
  satir: ["Total Income", "Total Expense", "GRAND NET", "Cash Income", "Cash Expense", "Cash Net", "Card Income", "Card Expense", "Card Net", "Transfer Income", "Transfer Expense", "Transfer Net", "Opening Balance", "Closing Balance", "Entries"],
  kutu: ["Cash Income", "Cash Expense", "Card Income", "Card Expense", "Transfer Income", "Transfer Expense", "Cash Net", "Card Net", "Transfer Net", "Total Income", "Total Expense", "Total Income"],
  serit: ["GRAND NET", "OPENING", "CLOSING"],
  katSec: "Categories", gunSec: "Daily net", fisSec: "Receipt list",
  thead: ["DATE", "DESCRIPTION", "AMOUNT"],
  kayitTekil: "records", footerOrta: "prepared with LedgerAI", ektedir: "file attached.",
  fisSayi: (n) => `Receipt list (${n} records)`,
  dahaFazla: (n) => `… and ${n} more records (all in Excel)`,
  kayitSayi: (n) => `${n} records`,
  topNakit: "Cash total", topKart: "Card total", topHavale: "Transfer total", topGenel: "GRAND TOTAL",
  gelirW: "income", giderW: "expense", altToplam: "Subtotal",
};

const DE: RaporMetin = {
  sayfaKapak: "Übersicht", sayfaGun: "Tagesliste", sayfaKat: "Kategorien", sayfaFis: "Belege",
  fisBaslik: "Belegliste (nach Zahlung)",
  fisKolon: ["Datum", "Beschreibung", "Kategorie", "Zahlung", "Einnahmen", "Ausgaben"],
  gunKolon: ["Datum", "Bar Netto", "Karte Netto", "Überweisung Netto", "Einnahmen", "Ausgaben", "Netto", "Trend", "Anzahl"],
  katKolon: ["Kategorie", "Anzahl", "Einnahmen", "Ausgaben", "Netto", "Ausgaben %"],
  toplam: "SUMME", bosFis: "Keine Belege im Zeitraum.", bosGun: "Keine Einträge im Zeitraum.",
  gosterge: "Kennzahl", tutarCol: "Betrag",
  satir: ["Einnahmen gesamt", "Ausgaben gesamt", "GESAMT NETTO", "Bar-Einnahmen", "Bar-Ausgaben", "Bar-Netto", "Karten-Einnahmen", "Karten-Ausgaben", "Karten-Netto", "Überweisung-Einnahmen", "Überweisung-Ausgaben", "Überweisung-Netto", "Anfangsbestand", "Endbestand", "Einträge"],
  kutu: ["Bar-Einnahmen", "Bar-Ausgaben", "Karten-Einnahmen", "Karten-Ausgaben", "Überweisung-Einnahmen", "Überweisung-Ausgaben", "Bar-Netto", "Karten-Netto", "Überweisung-Netto", "Einnahmen gesamt", "Ausgaben gesamt", "Einnahmen gesamt"],
  serit: ["GESAMT NETTO", "ANFANG", "ENDE"],
  katSec: "Kategorien", gunSec: "Tagesnetto", fisSec: "Belegliste",
  thead: ["DATUM", "BESCHREIBUNG", "BETRAG"],
  kayitTekil: "Einträge", footerOrta: "erstellt mit LedgerAI", ektedir: "Datei angehängt.",
  fisSayi: (n) => `Belegliste (${n} Einträge)`,
  dahaFazla: (n) => `… und ${n} weitere Einträge (alle in Excel)`,
  kayitSayi: (n) => `${n} Einträge`,
  topNakit: "Bar gesamt", topKart: "Karte gesamt", topHavale: "Überweisung gesamt", topGenel: "GESAMT",
  gelirW: "Einnahmen", giderW: "Ausgaben", altToplam: "Zwischensumme",
};

const FR: RaporMetin = {
  sayfaKapak: "Résumé", sayfaGun: "Journalier", sayfaKat: "Catégories", sayfaFis: "Reçus",
  fisBaslik: "Liste des reçus (par paiement)",
  fisKolon: ["Date", "Description", "Catégorie", "Paiement", "Revenus", "Dépenses"],
  gunKolon: ["Date", "Net espèces", "Net carte", "Net virement", "Revenus", "Dépenses", "Net", "Tendance", "Nombre"],
  katKolon: ["Catégorie", "Nombre", "Revenus", "Dépenses", "Net", "Dépenses %"],
  toplam: "TOTAL", bosFis: "Aucun reçu sur la période.", bosGun: "Aucune écriture sur la période.",
  gosterge: "Indicateur", tutarCol: "Montant",
  satir: ["Revenus totaux", "Dépenses totales", "NET GÉNÉRAL", "Revenus espèces", "Dépenses espèces", "Net espèces", "Revenus carte", "Dépenses carte", "Net carte", "Revenus virement", "Dépenses virement", "Net virement", "Solde initial", "Solde final", "Écritures"],
  kutu: ["Revenus espèces", "Dépenses espèces", "Revenus carte", "Dépenses carte", "Revenus virement", "Dépenses virement", "Net espèces", "Net carte", "Net virement", "Revenus totaux", "Dépenses totales", "Revenus totaux"],
  serit: ["NET GÉNÉRAL", "OUVERTURE", "CLÔTURE"],
  katSec: "Catégories", gunSec: "Net journalier", fisSec: "Liste des reçus",
  thead: ["DATE", "DESCRIPTION", "MONTANT"],
  kayitTekil: "écritures", footerOrta: "préparé avec LedgerAI", ektedir: "fichier joint.",
  fisSayi: (n) => `Liste des reçus (${n} écritures)`,
  dahaFazla: (n) => `… et ${n} écritures de plus (tout dans Excel)`,
  kayitSayi: (n) => `${n} écritures`,
  topNakit: "Total espèces", topKart: "Total carte", topHavale: "Total virement", topGenel: "TOTAL GÉNÉRAL",
  gelirW: "revenus", giderW: "dépenses", altToplam: "Sous-total",
};

const ES: RaporMetin = {
  sayfaKapak: "Resumen", sayfaGun: "Diario", sayfaKat: "Categorías", sayfaFis: "Recibos",
  fisBaslik: "Lista de recibos (por pago)",
  fisKolon: ["Fecha", "Descripción", "Categoría", "Pago", "Ingresos", "Gastos"],
  gunKolon: ["Fecha", "Neto efectivo", "Neto tarjeta", "Neto transferencia", "Ingresos", "Gastos", "Neto", "Tendencia", "Cantidad"],
  katKolon: ["Categoría", "Cantidad", "Ingresos", "Gastos", "Neto", "Gastos %"],
  toplam: "TOTAL", bosFis: "Sin recibos en el período.", bosGun: "Sin registros en el período.",
  gosterge: "Métrica", tutarCol: "Importe",
  satir: ["Ingresos totales", "Gastos totales", "NETO GENERAL", "Ingresos efectivo", "Gastos efectivo", "Neto efectivo", "Ingresos tarjeta", "Gastos tarjeta", "Neto tarjeta", "Ingresos transferencia", "Gastos transferencia", "Neto transferencia", "Saldo inicial", "Saldo final", "Registros"],
  kutu: ["Ingresos efectivo", "Gastos efectivo", "Ingresos tarjeta", "Gastos tarjeta", "Ingresos transferencia", "Gastos transferencia", "Neto efectivo", "Neto tarjeta", "Neto transferencia", "Ingresos totales", "Gastos totales", "Ingresos totales"],
  serit: ["NETO GENERAL", "APERTURA", "CIERRE"],
  katSec: "Categorías", gunSec: "Neto diario", fisSec: "Lista de recibos",
  thead: ["FECHA", "DESCRIPCIÓN", "IMPORTE"],
  kayitTekil: "registros", footerOrta: "preparado con LedgerAI", ektedir: "archivo adjunto.",
  fisSayi: (n) => `Lista de recibos (${n} registros)`,
  dahaFazla: (n) => `… y ${n} registros más (todo en Excel)`,
  kayitSayi: (n) => `${n} registros`,
  topNakit: "Total efectivo", topKart: "Total tarjeta", topHavale: "Total transferencia", topGenel: "TOTAL GENERAL",
  gelirW: "ingresos", giderW: "gastos", altToplam: "Subtotal",
};

const AR: RaporMetin = {
  sayfaKapak: "الملخص", sayfaGun: "اليومي", sayfaKat: "الفئات", sayfaFis: "الإيصالات",
  fisBaslik: "قائمة الإيصالات (حسب الدفع)",
  fisKolon: ["التاريخ", "الوصف", "الفئة", "الدفع", "الدخل", "المصروف"],
  gunKolon: ["التاريخ", "صافي النقد", "صافي البطاقة", "صافي التحويل", "الدخل", "المصروف", "الصافي", "الاتجاه", "العدد"],
  katKolon: ["الفئة", "العدد", "الدخل", "المصروف", "الصافي", "المصروف %"],
  toplam: "الإجمالي", bosFis: "لا إيصالات في الفترة.", bosGun: "لا قيود في الفترة.",
  gosterge: "المؤشر", tutarCol: "المبلغ",
  satir: ["إجمالي الدخل", "إجمالي المصروف", "الصافي العام", "دخل النقد", "مصروف النقد", "صافي النقد", "دخل البطاقة", "مصروف البطاقة", "صافي البطاقة", "دخل التحويل", "مصروف التحويل", "صافي التحويل", "الرصيد الافتتاحي", "الرصيد الختامي", "القيود"],
  kutu: ["دخل النقد", "مصروف النقد", "دخل البطاقة", "مصروف البطاقة", "دخل التحويل", "مصروف التحويل", "صافي النقد", "صافي البطاقة", "صافي التحويل", "إجمالي الدخل", "إجمالي المصروف", "إجمالي الدخل"],
  serit: ["الصافي العام", "الافتتاح", "الختام"],
  katSec: "الفئات", gunSec: "الصافي اليومي", fisSec: "قائمة الإيصالات",
  thead: ["التاريخ", "الوصف", "المبلغ"],
  kayitTekil: "قيود", footerOrta: "أُعد مع LedgerAI", ektedir: "المرفق.",
  fisSayi: (n) => `قائمة الإيصالات (${n} قيود)`,
  dahaFazla: (n) => `… و${n} قيود أخرى (الكل في Excel)`,
  kayitSayi: (n) => `${n} قيود`,
  topNakit: "إجمالي النقد", topKart: "إجمالي البطاقة", topHavale: "إجمالي التحويل", topGenel: "الإجمالي العام",
  gelirW: "الدخل", giderW: "المصروف", altToplam: "المجموع الفرعي",
};

const RU: RaporMetin = {
  sayfaKapak: "Итог", sayfaGun: "По дням", sayfaKat: "Категории", sayfaFis: "Чеки",
  fisBaslik: "Список чеков (по оплате)",
  fisKolon: ["Дата", "Описание", "Категория", "Оплата", "Доход", "Расход"],
  gunKolon: ["Дата", "Нал нетто", "Карта нетто", "Перевод нетто", "Доход", "Расход", "Нетто", "Тренд", "Кол-во"],
  katKolon: ["Категория", "Кол-во", "Доход", "Расход", "Нетто", "Расход %"],
  toplam: "ИТОГО", bosFis: "Чеков за период нет.", bosGun: "Записей за период нет.",
  gosterge: "Метрика", tutarCol: "Сумма",
  satir: ["Доход всего", "Расход всего", "ОБЩИЙ НЕТТО", "Нал доход", "Нал расход", "Нал нетто", "Карта доход", "Карта расход", "Карта нетто", "Перевод доход", "Перевод расход", "Перевод нетто", "Нач. остаток", "Кон. остаток", "Записи"],
  kutu: ["Нал доход", "Нал расход", "Карта доход", "Карта расход", "Перевод доход", "Перевод расход", "Нал нетто", "Карта нетто", "Перевод нетто", "Доход всего", "Расход всего", "Доход всего"],
  serit: ["ОБЩИЙ НЕТТО", "НАЧАЛО", "КОНЕЦ"],
  katSec: "Категории", gunSec: "Дневной нетто", fisSec: "Список чеков",
  thead: ["ДАТА", "ОПИСАНИЕ", "СУММА"],
  kayitTekil: "записи", footerOrta: "подготовлено в LedgerAI", ektedir: "файл приложен.",
  fisSayi: (n) => `Список чеков (${n} записи)`,
  dahaFazla: (n) => `… и ещё ${n} записи (все в Excel)`,
  kayitSayi: (n) => `${n} записи`,
  topNakit: "Нал итого", topKart: "Карта итого", topHavale: "Перевод итого", topGenel: "ОБЩИЙ ИТОГ",
  gelirW: "доход", giderW: "расход", altToplam: "Подытог",
};

const HEPSI: Record<string, RaporMetin> = { tr: TR, en: EN, de: DE, fr: FR, es: ES, ar: AR, ru: RU };

/** Seçili dilin rapor sözlüğü (bilinmeyende İngilizce). */
export function dilAl(locale?: string): RaporMetin {
  return HEPSI[locale ?? ""] ?? EN;
}

const ODEME: Record<string, Record<string, string>> = {
  tr: { Nakit: "Nakit", Kart: "Kart", Havale: "Havale" },
  en: { Nakit: "Cash", Kart: "Card", Havale: "Transfer" },
  de: { Nakit: "Bar", Kart: "Karte", Havale: "Überweisung" },
  fr: { Nakit: "Espèces", Kart: "Carte", Havale: "Virement" },
  es: { Nakit: "Efectivo", Kart: "Tarjeta", Havale: "Transferencia" },
  ar: { Nakit: "نقدي", Kart: "بطاقة", Havale: "تحويل" },
  ru: { Nakit: "Наличные", Kart: "Карта", Havale: "Перевод" },
};

/** Saklanan ödeme tipi → seçili dilde etiket. */
export function odemeEtiketi(odemeTipi: string, locale?: string): string {
  const m = ODEME[locale ?? ""] ?? ODEME.en;
  return m[odemeTipi] ?? odemeTipi;
}

const KAT_TR: Record<string, string> = {
  Rent: "Kira", Utilities: "Elektrik", Water: "Su", Heating: "Doğalgaz", Home: "Ev",
  Workshop: "İş Yeri", Service: "Hizmet", Groceries: "Market", Other: "Diğer",
};

/** Saklanan kategori → seçili dilde etiket (TR hariç saklanan İngilizce aynen). */
export function kategoriEtiketi(kategori: string, locale?: string): string {
  if ((locale ?? "en") === "tr") return KAT_TR[kategori] ?? kategori;
  return kategori;
}

/** Para birimi → Excel sayı biçimi simgesi. */
export function paraSembol(currency?: string): string {
  const m: Record<string, string> = {
    USD: "$", EUR: "€", TRY: "₺", GBP: "£", SAR: "ر.س",
    RUB: "₽", AED: "د.إ", AZN: "₼", GEL: "₾", UAH: "₴", EGP: "E£",
  };
  const c = String(currency ?? "USD").toUpperCase();
  return m[c] ?? c;
}
