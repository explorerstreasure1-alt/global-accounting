import {
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
  whatsappAlici: varchar("whatsapp_alici", { length: 30 }).notNull().default("0556102095"),
});

export const sohbetMesajlari = pgTable("sohbet_mesajlari", {
  id: uuid("id").primaryKey(),
  rol: varchar("rol", { length: 20 }).notNull(),
  icerik: text("icerik").notNull(),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date" }).notNull(),
});
