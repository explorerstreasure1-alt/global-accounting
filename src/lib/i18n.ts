"use client";

import { useEffect, useState } from "react";
import { globalDicts } from "./i18n-dict";

/** Global locale + theme foundation. Additive, breaks nothing. */

export const LOCALES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "tr", label: "Türkçe", dir: "ltr" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "de", label: "Deutsch", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type ThemeId = "notebook" | "pro-light" | "pro-dark";

export const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: "notebook", label: "Notebook Classic" },
  { id: "pro-light", label: "Pro Light" },
  { id: "pro-dark", label: "Pro Dark" },
];

type Dict = Record<string, string>;

const en: Dict = {
  app_sub: "Small business ledger",
  ledger: "Ledger",
  assistant: "Assistant",
  income: "Income",
  expense: "Expense",
  net: "Net",
  monthly_rent: "Monthly rent",
  calendar: "Calendar",
  day_end: "Day close",
  month_end: "Month close",
  z_report: "Z report",
  excel: "Excel",
  backup: "Backup",
  print: "Print",
  period: "Period",
  settings: "Settings",
  phone: "Phone",
  save: "Save",
  add: "Add",
  delete: "Delete",
  cancel: "Cancel",
  close: "Close",
  search: "Search ledger...",
  description: "Description",
  category: "Category",
  date: "Date",
  amount: "Amount",
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  new_entry: "New entry",
  edit: "Edit",
  confirm_delete: "Delete this row?",
  yes_delete: "Yes, delete",
  no: "No",
  total: "Total",
  rent_period: "Rent period",
  monthly_cover: "Monthly cover",
  next_rent: "Next rent",
  upload_backup: "Upload backup",
  ask_ai: "Ask assistant... e.g. Today cash alteration $50",
  send: "Send",
  clear_chat: "Clear chat",
  listening: "Listening...",
  month_names: "January,February,March,April,May,June,July,August,September,October,November,December",
  free_plan: "Starter",
  pro_plan: "Pro",
  per_month: "/month",
  start_free: "Open app",
  go_pro: "Go Pro — $3/mo",
  pro_active: "Pro active",
  payment: "Payment",
};

const tr: Dict = {
  app_sub: "Esnaf muhasebe defteri",
  ledger: "Defter",
  assistant: "Asistan",
  income: "Gelir",
  expense: "Gider",
  net: "Net",
  monthly_rent: "Aylık kira",
  calendar: "Takvim",
  day_end: "Gün sonu",
  month_end: "Ay sonu",
  z_report: "Z raporu",
  excel: "Excel",
  backup: "Yedek",
  print: "Yazdır",
  period: "Dönem",
  settings: "Ayarlar",
  phone: "Telefon",
  save: "Kaydet",
  add: "Ekle",
  delete: "Sil",
  cancel: "Vazgeç",
  close: "Kapat",
  search: "Defterde ara...",
  description: "Açıklama",
  category: "Kategori",
  date: "Tarih",
  amount: "Tutar",
  cash: "Nakit",
  card: "Kart",
  transfer: "Havale",
  new_entry: "Yeni kayıt",
  edit: "Düzenle",
  confirm_delete: "Bu satır silinsin mi?",
  yes_delete: "Evet, sil",
  no: "Hayır",
  total: "Toplam",
  rent_period: "Kira dönemi",
  monthly_cover: "Aylık karşılık",
  next_rent: "Sonraki kira",
  upload_backup: "Yedek yükle",
  ask_ai: "Asistana sor... örn. Bugün 500 TL nakit tadilat",
  send: "Gönder",
  clear_chat: "Sohbeti temizle",
  listening: "Dinleniyor...",
  month_names: "Ocak,Şubat,Mart,Nisan,Mayıs,Haziran,Temmuz,Ağustos,Eylül,Ekim,Kasım,Aralık",
  free_plan: "Başlangıç",
  pro_plan: "Pro",
  per_month: "/ay",
  start_free: "Uygulamayı aç",
  go_pro: "Pro'ya geç — $3/ay",
  pro_active: "Pro aktif",
  payment: "Ödeme",
};

const ru: Dict = {
  app_sub: "Бухгалтерия малого бизнеса",
  ledger: "Книга",
  assistant: "Ассистент",
  income: "Доход",
  expense: "Расход",
  net: "Итого",
  monthly_rent: "Аренда/мес",
  calendar: "Календарь",
  day_end: "Закрытие дня",
  month_end: "Закрытие месяца",
  z_report: "Z-отчёт",
  excel: "Excel",
  backup: "Бэкап",
  print: "Печать",
  period: "Период",
  settings: "Настройки",
  phone: "Телефон",
  save: "Сохранить",
  add: "Добавить",
  delete: "Удалить",
  cancel: "Отмена",
  close: "Закрыть",
  search: "Поиск по книге...",
  description: "Описание",
  category: "Категория",
  date: "Дата",
  amount: "Сумма",
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  new_entry: "Новая запись",
  edit: "Изменить",
  confirm_delete: "Удалить строку?",
  yes_delete: "Да, удалить",
  no: "Нет",
  total: "Итого",
  rent_period: "Период аренды",
  monthly_cover: "Покрытие/мес",
  next_rent: "След. аренда",
  upload_backup: "Загрузить бэкап",
  ask_ai: "Спросите... напр. Сегодня ремонт наличными $50",
  send: "Отправить",
  clear_chat: "Очистить чат",
  listening: "Слушаю...",
  month_names: "Январь,Февраль,Март,Апрель,Май,Июнь,Июль,Август,Сентябрь,Октябрь,Ноябрь,Декабрь",
  free_plan: "Старт",
  pro_plan: "Про",
  per_month: "/мес",
  start_free: "Открыть",
  go_pro: "Про — $3/мес",
  pro_active: "Про активен",
  payment: "Оплата",
};

// de/fr/es/ar: core translated, extended falls back to en
const de: Dict = {
  app_sub: "Kleinunternehmen-Buchhaltung",
  ledger: "Buch",
  assistant: "Assistent",
  income: "Einnahmen",
  expense: "Ausgaben",
  net: "Netto",
  monthly_rent: "Monatsmiete",
  calendar: "Kalender",
  day_end: "Tagesschluss",
  month_end: "Monatsschluss",
  z_report: "Z-Bericht",
  excel: "Excel",
  backup: "Backup",
  print: "Drucken",
  period: "Zeitraum",
  settings: "Einstellungen",
  phone: "Telefon",
  save: "Speichern",
  add: "Hinzufügen",
  delete: "Löschen",
  cancel: "Abbrechen",
  close: "Schließen",
  search: "Suchen...",
  description: "Beschreibung",
  category: "Kategorie",
  date: "Datum",
  amount: "Betrag",
  cash: "Bar",
  card: "Karte",
  transfer: "Überweisung",
  new_entry: "Neuer Eintrag",
  edit: "Bearbeiten",
  confirm_delete: "Zeile löschen?",
  yes_delete: "Ja, löschen",
  no: "Nein",
  total: "Gesamt",
  rent_period: "Mietzeitraum",
  monthly_cover: "Monatsanteil",
  next_rent: "Nächste Miete",
  upload_backup: "Backup laden",
  ask_ai: "Assistent fragen...",
  send: "Senden",
  clear_chat: "Chat leeren",
  listening: "Höre zu...",
  month_names: "Januar,Februar,März,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember",
  free_plan: "Start",
  pro_plan: "Pro",
  per_month: "/Monat",
  start_free: "App öffnen",
  go_pro: "Pro — $3/Monat",
  pro_active: "Pro aktiv",
  payment: "Zahlung",
};

const fr: Dict = {
  app_sub: "Compta petites entreprises",
  ledger: "Registre",
  assistant: "Assistant",
  income: "Recettes",
  expense: "Dépenses",
  net: "Net",
  monthly_rent: "Loyer mensuel",
  calendar: "Calendrier",
  day_end: "Clôture jour",
  month_end: "Clôture mois",
  z_report: "Rapport Z",
  excel: "Excel",
  backup: "Sauvegarde",
  print: "Imprimer",
  period: "Période",
  settings: "Paramètres",
  phone: "Téléphone",
  save: "Enregistrer",
  add: "Ajouter",
  delete: "Supprimer",
  cancel: "Annuler",
  close: "Fermer",
  search: "Rechercher...",
  description: "Description",
  category: "Catégorie",
  date: "Date",
  amount: "Montant",
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  new_entry: "Nouvelle entrée",
  edit: "Modifier",
  confirm_delete: "Supprimer la ligne ?",
  yes_delete: "Oui, supprimer",
  no: "Non",
  total: "Total",
  rent_period: "Période loyer",
  monthly_cover: "Part mensuelle",
  next_rent: "Prochain loyer",
  upload_backup: "Charger sauvegarde",
  ask_ai: "Demander à l'assistant...",
  send: "Envoyer",
  clear_chat: "Effacer chat",
  listening: "Écoute...",
  month_names: "Janvier,Février,Mars,Avril,Mai,Juin,Juillet,Août,Septembre,Octobre,Novembre,Décembre",
  free_plan: "Départ",
  pro_plan: "Pro",
  per_month: "/mois",
  start_free: "Ouvrir l'app",
  go_pro: "Pro — $3/mois",
  pro_active: "Pro actif",
  payment: "Paiement",
};

const es: Dict = {
  app_sub: "Contabilidad negocios",
  ledger: "Libro",
  assistant: "Asistente",
  income: "Ingresos",
  expense: "Gastos",
  net: "Neto",
  monthly_rent: "Alquiler mensual",
  calendar: "Calendario",
  day_end: "Cierre día",
  month_end: "Cierre mes",
  z_report: "Informe Z",
  excel: "Excel",
  backup: "Copia",
  print: "Imprimir",
  period: "Período",
  settings: "Ajustes",
  phone: "Teléfono",
  save: "Guardar",
  add: "Añadir",
  delete: "Eliminar",
  cancel: "Cancelar",
  close: "Cerrar",
  search: "Buscar...",
  description: "Descripción",
  category: "Categoría",
  date: "Fecha",
  amount: "Importe",
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  new_entry: "Nueva entrada",
  edit: "Editar",
  confirm_delete: "¿Eliminar fila?",
  yes_delete: "Sí, eliminar",
  no: "No",
  total: "Total",
  rent_period: "Período alquiler",
  monthly_cover: "Cuota mensual",
  next_rent: "Próx. alquiler",
  upload_backup: "Cargar copia",
  ask_ai: "Pregunta al asistente...",
  send: "Enviar",
  clear_chat: "Limpiar chat",
  listening: "Escuchando...",
  month_names: "Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre",
  free_plan: "Inicio",
  pro_plan: "Pro",
  per_month: "/mes",
  start_free: "Abrir app",
  go_pro: "Pro — $3/mes",
  pro_active: "Pro activo",
  payment: "Pago",
};

const ar: Dict = {
  app_sub: "دفتر المحاسبة",
  ledger: "الدفتر",
  assistant: "المساعد",
  income: "الدخل",
  expense: "المصروف",
  net: "الصافي",
  monthly_rent: "الإيجار الشهري",
  calendar: "التقويم",
  day_end: "إغلاق اليوم",
  month_end: "إغلاق الشهر",
  z_report: "تقرير Z",
  excel: "Excel",
  backup: "نسخة",
  print: "طباعة",
  period: "الفترة",
  settings: "الإعدادات",
  phone: "الهاتف",
  save: "حفظ",
  add: "إضافة",
  delete: "حذف",
  cancel: "إلغاء",
  close: "إغلاق",
  search: "بحث...",
  description: "الوصف",
  category: "الفئة",
  date: "التاريخ",
  amount: "المبلغ",
  cash: "نقدي",
  card: "بطاقة",
  transfer: "تحويل",
  new_entry: "قيد جديد",
  edit: "تعديل",
  confirm_delete: "حذف السطر؟",
  yes_delete: "نعم، احذف",
  no: "لا",
  total: "الإجمالي",
  rent_period: "فترة الإيجار",
  monthly_cover: "الحصة الشهرية",
  next_rent: "الإيجار التالي",
  upload_backup: "تحميل نسخة",
  ask_ai: "اسأل المساعد...",
  send: "إرسال",
  clear_chat: "مسح المحادثة",
  listening: "أستمع...",
  month_names: "يناير,فبراير,مارس,أبريل,مايو,يونيو,يوليو,أغسطس,سبتمبر,أكتوبر,نوفمبر,ديسمبر",
  free_plan: "البداية",
  pro_plan: "احترافي",
  per_month: "/شهر",
  start_free: "افتح التطبيق",
  go_pro: "احترافي — $3/شهر",
  pro_active: "احترافي مفعّل",
  payment: "الدفع",
};

const MAP: Record<LocaleCode, Dict> = {
  en: { ...en, ...globalDicts.en },
  tr: { ...tr, ...globalDicts.tr },
  ru: { ...ru, ...globalDicts.ru },
  de: { ...de, ...globalDicts.de },
  fr: { ...fr, ...globalDicts.fr },
  es: { ...es, ...globalDicts.es },
  ar: { ...ar, ...globalDicts.ar },
};

/** Locale → Intl + default currency. */
export const LOCALE_META: Record<LocaleCode, { intl: string; currency: string }> = {
  en: { intl: "en-US", currency: "USD" },
  tr: { intl: "tr-TR", currency: "TRY" },
  ru: { intl: "ru-RU", currency: "RUB" },
  de: { intl: "de-DE", currency: "EUR" },
  fr: { intl: "fr-FR", currency: "EUR" },
  es: { intl: "es-ES", currency: "EUR" },
  ar: { intl: "ar-SA", currency: "SAR" },
};

export const CURRENCIES = [
  { code: "TRY", label: "TRY ₺" },
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
  { code: "SAR", label: "SAR ر.س" },
  { code: "RUB", label: "RUB ₽" },
  { code: "AED", label: "AED د.إ" },
] as const;

export function getLocale(): LocaleCode {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem("tailor-locale") || "en";
  return (Object.keys(MAP) as LocaleCode[]).includes(v as LocaleCode) ? (v as LocaleCode) : "en";
}

export function setLocale(code: LocaleCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("tailor-locale", code);
  const meta = LOCALES.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta?.dir || "ltr";
  // Kullanıcı elle para birimi seçmediyse dilin varsayılanına geç
  try {
    if (!window.localStorage.getItem("tailor-currency")) {
      const cur = LOCALE_META[code]?.currency ?? "USD";
      window.localStorage.setItem("tailor-currency", cur);
      window.dispatchEvent(new CustomEvent("tailor-currency-change", { detail: cur }));
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("tailor-locale-change", { detail: code }));
}

export function getTheme(): ThemeId {
  if (typeof window === "undefined") return "notebook";
  const v = window.localStorage.getItem("tailor-theme") || "notebook";
  return v === "pro-light" || v === "pro-dark" ? v : "notebook";
}

export function setTheme(id: ThemeId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("tailor-theme", id);
  document.documentElement.dataset.theme = id;
}

export function getCurrency(fallbackLocale?: LocaleCode): string {
  if (typeof window === "undefined") return "USD";
  const v = window.localStorage.getItem("tailor-currency");
  if (v && /^[A-Z]{3}$/.test(v)) return v;
  const loc = fallbackLocale ?? getLocale();
  return LOCALE_META[loc]?.currency ?? "USD";
}

export function setCurrency(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("tailor-currency", code);
  window.dispatchEvent(new CustomEvent("tailor-currency-change", { detail: code }));
}

/** Stored English category → display label. TR shows Turkish, others show stored English. */
const KAT_TR: Record<string, string> = {
  Rent: "Kira", Utilities: "Elektrik", Water: "Su", Heating: "Doğalgaz", Home: "Ev",
  Workshop: "İş Yeri", Service: "Hizmet", Groceries: "Market", Other: "Diğer",
};
export function catLabel(kategori: string, locale: LocaleCode): string {
  if (locale === "tr") return KAT_TR[kategori] ?? kategori;
  return kategori;
}

export function t(locale: LocaleCode, key: string): string {
  return MAP[locale]?.[key] ?? en[key] ?? key;
}

/** Reactive translator hook. Re-renders on language/currency change. */
export function useT(): { locale: LocaleCode; t: (key: string) => string; intl: string; currency: string } {
  const [locale, setLoc] = useState<LocaleCode>(() => getLocale());
  const [currency, setCur] = useState<string>(() => getCurrency(getLocale()));
  useEffect(() => {
    const fn = (e: Event) => {
      const v = (e as CustomEvent).detail as LocaleCode;
      setLoc(v);
      setCur(getCurrency(v));
    };
    const cur = (e: Event) => setCur((e as CustomEvent).detail as string);
    const storage = () => {
      setLoc(getLocale());
      setCur(getCurrency());
    };
    window.addEventListener("tailor-locale-change", fn as EventListener);
    window.addEventListener("tailor-currency-change", cur as EventListener);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("tailor-locale-change", fn as EventListener);
      window.removeEventListener("tailor-currency-change", cur as EventListener);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const meta = LOCALE_META[locale] ?? LOCALE_META.en;
  return { locale, t: (key: string) => t(locale, key), intl: meta.intl, currency };
}



