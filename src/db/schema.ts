import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const kayitlar = pgTable("kayitlar", {
  id: uuid("id").primaryKey(),
  tarih: date("tarih", { mode: "string" }).notNull(),
  aciklama: text("aciklama").notNull(),
  kategori: varchar("kategori", { length: 50 }).notNull(),
  gelir: numeric("gelir", { precision: 14, scale: 2 }).notNull().default("0"),
  gider: numeric("gider", { precision: 14, scale: 2 }).notNull().default("0"),
  odemeTipi: varchar("odeme_tipi", { length: 20 }).notNull(),
  kasaEtkisi: numeric("kasa_etkisi", { precision: 14, scale: 2 }).notNull(),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date" }).notNull(),
});

export const ayarlar = pgTable("ayarlar", {
  id: integer("id").primaryKey(),
  isletmeAdi: varchar("isletme_adi", { length: 200 }).notNull(),
  kiraTutari: numeric("kira_tutari", { precision: 14, scale: 2 }).notNull(),
  kiraPeriyodu: integer("kira_periyodu").notNull(),
  aylikKiraKarsiligi: numeric("aylik_kira_karsiligi", { precision: 14, scale: 2 }).notNull(),
  paraBirimi: varchar("para_birimi", { length: 10 }).notNull().default("TL"),
  kiraSonrakiTarih: date("kira_sonraki_tarih", { mode: "string" }),
  acilisBakiyesi: numeric("acilis_bakiyesi", { precision: 14, scale: 2 }).notNull().default("0"),
  aiMotor: varchar("ai_motor", { length: 20 }).notNull().default("otomatik"),
  ollamaModel: varchar("ollama_model", { length: 100 }).notNull().default("gemma3:4b"),
  whatsappAlici: varchar("whatsapp_alici", { length: 30 }).notNull().default(""),
  whatsappIsletme: varchar("whatsapp_isletme", { length: 30 }).notNull().default(""),
  waSablonAlindi: text("wa_sablon_alindi").notNull().default(""),
  waSablonHazir: text("wa_sablon_hazir").notNull().default(""),
  googleYorumLink: text("google_yorum_link").notNull().default(""),
  meslek: varchar("meslek", { length: 60 }).notNull().default(""),
  hizmetSecimiAcik: boolean("hizmet_secimi_acik").notNull().default(true),
});

export const sohbetMesajlari = pgTable("sohbet_mesajlari", {
  id: uuid("id").primaryKey(),
  rol: varchar("rol", { length: 20 }).notNull(),
  icerik: text("icerik").notNull(),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date" }).notNull(),
});

/** Müşteri kartı (EGZEL ARYA'dan taşındı, tek kiracılı yerelde business yok). */
export const musteriler = pgTable("musteriler", {
  id: uuid("id").primaryKey(),
  ad: text("ad").notNull(),
  soyad: text("soyad").notNull().default(""),
  telefon: text("telefon").notNull().default(""),
  not: text("not").notNull().default(""),
  silindiAt: timestamp("silindi_at", { mode: "date" }),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date" }).notNull(),
});

/** Ziyaret/sipariş satırı — müşterinin her gelişi. */
export const ziyaretler = pgTable("ziyaretler", {
  id: uuid("id").primaryKey(),
  musteriId: uuid("musteri_id").notNull(),
  hizmet: text("hizmet").notNull().default(""),
  tutar: numeric("tutar", { precision: 14, scale: 2 }).notNull().default("0"),
  tarih: date("tarih", { mode: "string" }).notNull(),
  not: text("not").notNull().default(""),
  durum: varchar("durum", { length: 20 }).notNull().default("hazirlaniyor"),
  odenen: numeric("odenen", { precision: 14, scale: 2 }),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date" }).notNull(),
});
