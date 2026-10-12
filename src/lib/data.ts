import { desc, eq } from "drizzle-orm";
import { promises as nodeFs } from "node:fs";
import path from "node:path";
import { db, hasDatabase, pool } from "@/db";
import { ayarlar, kayitlar, musteriler, sohbetMesajlari, ziyaretler } from "@/db/schema";
import type { Ayarlar, InitData, Kayit, KayitGirdi, Kategori, Musteri, MusteriGirdi, OdemeTipi, SohbetMesaji, Ziyaret, ZiyaretDurum, ZiyaretGirdi } from "./types";
import { addDays, addMonths, num, round2, toISODate } from "./format";
import { KATEGORILER, KATEGORI_ESKI } from "./types";
import {
  fileGetAll,
  fileSaveAll,
  fileSaveAyarlar,
  fileSaveKayitlar,
  fileSaveMesajlar,
  getDataDir,
  getLatestBackup,
  mirrorToFile,
} from "./file-store";

function mapKayit(row: typeof kayitlar.$inferSelect): Kayit {
  const list = KATEGORILER as readonly string[];
  const kategori = list.includes(row.kategori)
    ? (row.kategori as Kategori)
    : ((KATEGORI_ESKI[row.kategori] ?? "Other") as Kategori);
  return {
    id: row.id,
    tarih: row.tarih,
    aciklama: row.aciklama,
    kategori,
    gelir: num(row.gelir),
    gider: num(row.gider),
    odemeTipi: row.odemeTipi === "Kart" ? "Kart" : row.odemeTipi === "Havale" ? "Havale" : "Nakit",
    kasaEtkisi: num(row.kasaEtkisi),
    olusturmaZamani: row.olusturmaZamani.toISOString(),
  };
}

function mapAyarlar(row: typeof ayarlar.$inferSelect): Ayarlar {
  const raw = row as Record<string, unknown>;
  return {
    id: row.id,
    isletmeAdi: row.isletmeAdi,
    kiraTutari: num(row.kiraTutari),
    kiraPeriyodu: row.kiraPeriyodu,
    aylikKiraKarsiligi: num(row.aylikKiraKarsiligi),
    paraBirimi: row.paraBirimi,
    kiraSonrakiTarih: row.kiraSonrakiTarih,
    acilisBakiyesi: num(row.acilisBakiyesi),
    aiMotor: raw.aiMotor === "groq" || raw.aiMotor === "ollama" ? raw.aiMotor : "otomatik",
    ollamaModel: typeof raw.ollamaModel === "string" && raw.ollamaModel.trim() ? raw.ollamaModel.trim() : "gemma3:4b",
    whatsappAlici: typeof raw.whatsappAlici === "string" && raw.whatsappAlici.trim() ? raw.whatsappAlici.trim() : "",
  };
}

function mapMesaj(row: typeof sohbetMesajlari.$inferSelect): SohbetMesaji {
  return {
    id: row.id,
    rol: row.rol === "user" ? "user" : "assistant",
    icerik: row.icerik,
    olusturmaZamani: row.olusturmaZamani.toISOString(),
  };
}

function seedKayitlar(today: string): KayitGirdi[] {
  const d = (offset: number) => addDays(today, offset);
  return [
    { tarih: d(-12), aciklama: "Opening cash alteration", kategori: "Service", gelir: 82, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-12), aciklama: "Card alteration", kategori: "Service", gelir: 46.5, gider: 0, odemeTipi: "Kart" },
    { tarih: d(-11), aciklama: "Fabric store", kategori: "Groceries", gelir: 0, gider: 8.9, odemeTipi: "Nakit" },
    { tarih: d(-10), aciklama: "Daily alteration", kategori: "Service", gelir: 71, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-10), aciklama: "Water bill", kategori: "Water", gelir: 0, gider: 4.2, odemeTipi: "Kart" },
    { tarih: d(-8), aciklama: "Electricity bill", kategori: "Utilities", gelir: 0, gider: 12.5, odemeTipi: "Kart" },
    { tarih: d(-7), aciklama: "Weekend alteration", kategori: "Service", gelir: 98, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-7), aciklama: "Card alteration", kategori: "Service", gelir: 54, gider: 0, odemeTipi: "Kart" },
    { tarih: d(-6), aciklama: "Heating bill", kategori: "Heating", gelir: 0, gider: 18.75, odemeTipi: "Kart" },
    { tarih: d(-5), aciklama: "Shop cleaning supplies", kategori: "Workshop", gelir: 0, gider: 3.4, odemeTipi: "Nakit" },
    { tarih: d(-4), aciklama: "Daily alteration", kategori: "Service", gelir: 64, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-3), aciklama: "Home groceries", kategori: "Home", gelir: 0, gider: 5.6, odemeTipi: "Kart" },
    { tarih: d(-2), aciklama: "Daily alteration", kategori: "Service", gelir: 73, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-2), aciklama: "Card alteration", kategori: "Service", gelir: 39, gider: 0, odemeTipi: "Kart" },
    { tarih: d(-1), aciklama: "Extra electricity", kategori: "Utilities", gelir: 0, gider: 3.8, odemeTipi: "Nakit" },
    { tarih: today, aciklama: "Morning cash alteration", kategori: "Service", gelir: 27.5, gider: 0, odemeTipi: "Nakit" },
    { tarih: today, aciklama: "Afternoon card alteration", kategori: "Service", gelir: 16.8, gider: 0, odemeTipi: "Kart" },
  ];
}

/** DB varken DB + dosyaya ayna, DB yoksa/hata verirse dosyadan devam. */
async function withDb<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!hasDatabase || !db) return fallback();
  try {
    return await fn();
  } catch (err) {
    console.warn("[hafiza] Postgres erişilemedi, dosya moduna geçildi:", (err as Error)?.message);
    return fallback();
  }
}

export async function ensureDefaults(): Promise<void> {
  // Dosya katmanı her zaman hazır olsun (çift katman)
  await fileGetAll().catch(() => undefined);
  await withDb(
    async () => {
      const existing = await db!.select().from(ayarlar).limit(1);
      if (existing.length > 0) return;

      const today = toISODate();
      await db!.insert(ayarlar).values({
        id: 1,
        isletmeAdi: "My Shop",
        kiraTutari: "1500.00",
        kiraPeriyodu: 6,
        aylikKiraKarsiligi: "250.00",
        paraBirimi: "USD",
        kiraSonrakiTarih: addMonths(today, 1).slice(0, 8) + "01",
        acilisBakiyesi: "125.00",
        aiMotor: "otomatik",
        ollamaModel: "gemma3:4b",
        whatsappAlici: "",
      });

      const now = new Date();
      const rows = seedKayitlar(today).map((k) => ({
        id: crypto.randomUUID(),
        tarih: k.tarih,
        aciklama: k.aciklama,
        kategori: k.kategori,
        gelir: k.gelir.toFixed(2),
        gider: k.gider.toFixed(2),
        odemeTipi: k.odemeTipi,
        kasaEtkisi: round2(k.gelir - k.gider).toFixed(2),
        olusturmaZamani: now,
      }));
      await db!.insert(kayitlar).values(rows);

      await db!.insert(sohbetMesajlari).values({
        id: crypto.randomUUID(),
        rol: "assistant",
        icerik:
          "Hello, I'm LedgerAI — your shop assistant. Add entries in natural language, get day close and Z reports.\n\nExamples:\n• \"Today cash service $50\"\n• \"Paid electricity $12.50 by card\"\n• \"This month's profit and loss?\"\n• \"Z report 1-15\"",

        olusturmaZamani: now,
      });
    },
    async () => undefined,
  );
}

export async function getInitData(): Promise<InitData> {
  await ensureDefaults();
  return withDb(
    async () => {
      const [kayitRows, ayarRows, mesajRows] = await Promise.all([
        db!.select().from(kayitlar),
        db!.select().from(ayarlar).where(eq(ayarlar.id, 1)).limit(1),
        db!.select().from(sohbetMesajlari).orderBy(desc(sohbetMesajlari.olusturmaZamani)).limit(200),
      ]);

      const data: InitData = {
        kayitlar: kayitRows.map(mapKayit).sort((a, b) => a.tarih.localeCompare(b.tarih)),
        ayarlar: mapAyarlar(ayarRows[0]),
        mesajlar: mesajRows.map(mapMesaj).reverse(),
      };
      // Başarılı okumayı dosyaya aynala (hafıza güçlendirme)
      void mirrorToFile(data.kayitlar, data.ayarlar, data.mesajlar);
      return data;
    },
    async () => fileGetAll(),
  );
}

export async function listKayitlar(): Promise<Kayit[]> {
  return withDb(
    async () => {
      const rows = await db!.select().from(kayitlar);
      const list = rows.map(mapKayit).sort((a, b) => a.tarih.localeCompare(b.tarih));
      void fileSaveKayitlar(list).catch(() => undefined);
      return list;
    },
    async () => (await fileGetAll()).kayitlar,
  );
}

export async function getAyarlar(): Promise<Ayarlar> {
  await ensureDefaults();
  return withDb(
    async () => {
      const rows = await db!.select().from(ayarlar).where(eq(ayarlar.id, 1)).limit(1);
      const a = mapAyarlar(rows[0]);
      void fileSaveAyarlar(a).catch(() => undefined);
      return a;
    },
    async () => (await fileGetAll()).ayarlar,
  );
}

/** ISO tarihi doğrula; bozuksa bugünü ver (deftere çöp tarih girmez) */
function gecerliTarih(t: string | undefined | null): string {
  const s = String(t || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return s;
    }
  }
  return toISODate();
}

export async function createKayit(input: KayitGirdi): Promise<Kayit> {
  const gelir = round2(Math.max(0, input.gelir || 0));
  const gider = round2(Math.max(0, input.gider || 0));
  // Geçmiş tarih dahil her tarih kabul (takvim yapısı); bozuksa bugüne düş
  const tarih = gecerliTarih(input.tarih);
  return withDb(
    async () => {
      const row = {
        id: crypto.randomUUID(),
        tarih,
        aciklama: input.aciklama.trim() || "Entry",
        kategori: input.kategori,
        gelir: gelir.toFixed(2),
        gider: gider.toFixed(2),
        odemeTipi: input.odemeTipi,
        kasaEtkisi: round2(gelir - gider).toFixed(2),
        olusturmaZamani: new Date(),
      };
      await db!.insert(kayitlar).values(row);
      const kayit = mapKayit({ ...row, gelir: row.gelir, gider: row.gider, kasaEtkisi: row.kasaEtkisi });
      // Ayna
      void listKayitlar().catch(() => undefined);
      return kayit;
    },
    async () => {
      const { kayitlar: list } = await fileGetAll();
      const kayit: Kayit = {
        id: crypto.randomUUID(),
        tarih,
        aciklama: input.aciklama.trim() || "Entry",
        kategori: input.kategori,
        gelir,
        gider,
        odemeTipi: input.odemeTipi,
        kasaEtkisi: round2(gelir - gider),
        olusturmaZamani: new Date().toISOString(),
      };
      await fileSaveKayitlar([...list, kayit].sort((a, b) => a.tarih.localeCompare(b.tarih)));
      return kayit;
    },
  );
}

export async function updateKayit(id: string, patch: Partial<KayitGirdi>): Promise<Kayit | null> {
  return withDb(
    async () => {
      const currentRows = await db!.select().from(kayitlar).where(eq(kayitlar.id, id)).limit(1);
      if (currentRows.length === 0) return null;
      const current = mapKayit(currentRows[0]);
      const next: KayitGirdi = {
        tarih: patch.tarih ? gecerliTarih(patch.tarih) : current.tarih,
        aciklama: patch.aciklama ?? current.aciklama,
        kategori: patch.kategori ?? current.kategori,
        gelir: patch.gelir != null ? round2(Math.max(0, patch.gelir)) : current.gelir,
        gider: patch.gider != null ? round2(Math.max(0, patch.gider)) : current.gider,
        odemeTipi: patch.odemeTipi ?? current.odemeTipi,
      };
      const kasaEtkisi = round2(next.gelir - next.gider);
      await db!
        .update(kayitlar)
        .set({
          tarih: next.tarih,
          aciklama: next.aciklama,
          kategori: next.kategori,
          gelir: next.gelir.toFixed(2),
          gider: next.gider.toFixed(2),
          odemeTipi: next.odemeTipi,
          kasaEtkisi: kasaEtkisi.toFixed(2),
        })
        .where(eq(kayitlar.id, id));
      void listKayitlar().catch(() => undefined);
      return { ...current, ...next, kasaEtkisi };
    },
    async () => {
      const { kayitlar: list } = await fileGetAll();
      const idx = list.findIndex((k) => k.id === id);
      if (idx < 0) return null;
      const current = list[idx];
      const next: Kayit = {
        ...current,
        tarih: patch.tarih ? gecerliTarih(patch.tarih) : current.tarih,
        aciklama: patch.aciklama ?? current.aciklama,
        kategori: patch.kategori ?? current.kategori,
        gelir: patch.gelir != null ? round2(Math.max(0, patch.gelir)) : current.gelir,
        gider: patch.gider != null ? round2(Math.max(0, patch.gider)) : current.gider,
        odemeTipi: patch.odemeTipi ?? current.odemeTipi,
        kasaEtkisi: 0,
      };
      next.kasaEtkisi = round2(next.gelir - next.gider);
      const yeni = [...list];
      yeni[idx] = next;
      await fileSaveKayitlar(yeni.sort((a, b) => a.tarih.localeCompare(b.tarih)));
      return next;
    },
  );
}

export async function deleteKayit(id: string): Promise<boolean> {
  return withDb(
    async () => {
      const currentRows = await db!.select().from(kayitlar).where(eq(kayitlar.id, id)).limit(1);
      if (currentRows.length === 0) return false;
      await db!.delete(kayitlar).where(eq(kayitlar.id, id));
      void listKayitlar().catch(() => undefined);
      return true;
    },
    async () => {
      const { kayitlar: list } = await fileGetAll();
      if (!list.some((k) => k.id === id)) return false;
      await fileSaveKayitlar(list.filter((k) => k.id !== id));
      return true;
    },
  );
}

export async function updateAyarlar(patch: Partial<Ayarlar>): Promise<Ayarlar> {
  const current = await getAyarlar();
  const kiraTutari = patch.kiraTutari ?? current.kiraTutari;
  const kiraPeriyodu = patch.kiraPeriyodu ?? current.kiraPeriyodu;
  const aylik =
    patch.aylikKiraKarsiligi ??
    (kiraPeriyodu > 0 ? round2(kiraTutari / kiraPeriyodu) : current.aylikKiraKarsiligi);
  const nextAyar: Ayarlar = {
    ...current,
    isletmeAdi: patch.isletmeAdi ?? current.isletmeAdi,
    kiraTutari,
    kiraPeriyodu,
    aylikKiraKarsiligi: aylik,
    paraBirimi: patch.paraBirimi ?? current.paraBirimi,
    kiraSonrakiTarih: patch.kiraSonrakiTarih === undefined ? current.kiraSonrakiTarih : patch.kiraSonrakiTarih,
    acilisBakiyesi: patch.acilisBakiyesi ?? current.acilisBakiyesi,
    aiMotor: patch.aiMotor === "groq" || patch.aiMotor === "ollama" || patch.aiMotor === "otomatik" ? patch.aiMotor : current.aiMotor,
    ollamaModel:
      patch.ollamaModel !== undefined
        ? patch.ollamaModel.trim() || "gemma3:4b"
        : (current.ollamaModel || "gemma3:4b"),
    whatsappAlici:
      patch.whatsappAlici !== undefined
        ? patch.whatsappAlici.trim() || ""
        : (current.whatsappAlici || ""),
  };
  return withDb(
    async () => {
      const next = {
        isletmeAdi: nextAyar.isletmeAdi,
        kiraTutari: nextAyar.kiraTutari.toFixed(2),
        kiraPeriyodu: nextAyar.kiraPeriyodu,
        aylikKiraKarsiligi: nextAyar.aylikKiraKarsiligi.toFixed(2),
        paraBirimi: nextAyar.paraBirimi,
        kiraSonrakiTarih: nextAyar.kiraSonrakiTarih,
        acilisBakiyesi: nextAyar.acilisBakiyesi.toFixed(2),
        aiMotor: nextAyar.aiMotor,
        ollamaModel: nextAyar.ollamaModel,
        whatsappAlici: nextAyar.whatsappAlici,
      };
      await db!.update(ayarlar).set(next).where(eq(ayarlar.id, 1));
      void fileSaveAyarlar(nextAyar).catch(() => undefined);
      return nextAyar;
    },
    async () => {
      await fileSaveAyarlar(nextAyar);
      return nextAyar;
    },
  );
}

export async function addMesaj(rol: "user" | "assistant", icerik: string): Promise<SohbetMesaji> {
  return withDb(
    async () => {
      const row = {
        id: crypto.randomUUID(),
        rol,
        icerik,
        olusturmaZamani: new Date(),
      };
      await db!.insert(sohbetMesajlari).values(row);
      const mesaj = mapMesaj(row);
      // Sohbeti dosyaya da aynala (200 son mesaj)
      try {
        const { mesajlar } = await fileGetAll();
        await fileSaveMesajlar([...mesajlar, mesaj].slice(-500));
      } catch {
        /* ignore */
      }
      return mesaj;
    },
    async () => {
      const { mesajlar } = await fileGetAll();
      const mesaj: SohbetMesaji = {
        id: crypto.randomUUID(),
        rol,
        icerik,
        olusturmaZamani: new Date().toISOString(),
      };
      await fileSaveMesajlar([...mesajlar, mesaj].slice(-500));
      return mesaj;
    },
  );
}

const SELAMLAMA: Record<string, string> = {
  tr: "Sohbet temizlendi. Ben Defterdar, dijital muhasebeciniz. Nasıl yardımcı olayım?",
  en: "Chat cleared. I'm LedgerAI, your shop assistant. How can I help?",
  de: "Chat gelöscht. Ich bin LedgerAI, Ihr Assistent. Wie kann ich helfen?",
  fr: "Discussion effacée. Je suis LedgerAI, votre assistant. Comment aider ?",
  es: "Chat borrado. Soy LedgerAI, tu asistente. ¿En qué ayudo?",
  ar: "تم مسح المحادثة. أنا LedgerAI، مساعدك. كيف أساعد؟",
  ru: "Чат очищен. Я LedgerAI, ваш ассистент. Чем помочь?",
};

/** Sohbeti temizle: eski mesajlar gider, selamlama kalır. Kayıtlara dokunulmaz. */
export async function temizleSohbet(locale = "en"): Promise<SohbetMesaji[]> {
  const selamIcerik = SELAMLAMA[locale] ?? SELAMLAMA.en;
  const selam: SohbetMesaji = {
    id: crypto.randomUUID(),
    rol: "assistant",
    icerik: selamIcerik,
    olusturmaZamani: new Date().toISOString(),
  };
  return withDb(
    async () => {
      await db!.delete(sohbetMesajlari);
      await db!.insert(sohbetMesajlari).values({
        id: selam.id,
        rol: selam.rol,
        icerik: selam.icerik,
        olusturmaZamani: new Date(selam.olusturmaZamani),
      });
      void fileSaveMesajlar([selam]).catch(() => undefined);
      return [selam];
    },
    async () => {
      await fileSaveMesajlar([selam]);
      return [selam];
    },
  );
}

export function emptyKayit(tarih: string): KayitGirdi {
  return {
    tarih,
    aciklama: "",
    kategori: "Other",
    gelir: 0,
    gider: 0,
    odemeTipi: "Nakit",
  };
}

/**
 * TÜM VERİYİ SIFIRLA: kayıtlar silinir, açılış bakiyesi + kira sıfırlanır,
 * sohbet temizlenip selamlama konur. İşletme adı korunur.
 * Güncelleme/sil-düğmesi fark etmez, iki modda da (DB + dosya) çalışır.
 */
export async function sifirlaTumu(): Promise<InitData> {
  const mevcut = await getAyarlar();
  const sifirAyar: Ayarlar = {
    ...mevcut,
    kiraTutari: 0,
    kiraPeriyodu: 1,
    aylikKiraKarsiligi: 0,
    kiraSonrakiTarih: null,
    acilisBakiyesi: 0,
  };
  const selam: SohbetMesaji = {
    id: crypto.randomUUID(),
    rol: "assistant",
    icerik:
      "Ledger reset — fresh start.\n\nRecords cleared, opening balance and rent reset.\n\nExamples:\n• \"Today cash alteration $50\"\n• \"March 12 card alteration $20\"\n• \"Month close\" / \"Day close\"",
    olusturmaZamani: new Date().toISOString(),
  };
  return withDb(
    async () => {
      await db!.delete(kayitlar);
      await db!.delete(sohbetMesajlari);
      await db!
        .update(ayarlar)
        .set({
          isletmeAdi: sifirAyar.isletmeAdi,
          kiraTutari: "0.00",
          kiraPeriyodu: 1,
          aylikKiraKarsiligi: "0.00",
          paraBirimi: sifirAyar.paraBirimi,
          kiraSonrakiTarih: null,
          acilisBakiyesi: "0.00",
        })
        .where(eq(ayarlar.id, 1));
      await db!.insert(sohbetMesajlari).values({
        id: selam.id,
        rol: selam.rol,
        icerik: selam.icerik,
        olusturmaZamani: new Date(selam.olusturmaZamani),
      });
      const data: InitData = { kayitlar: [], ayarlar: sifirAyar, mesajlar: [selam] };
      void mirrorToFile([], sifirAyar, [selam]);
      return data;
    },
    async () => {
      await fileSaveAll([], sifirAyar, [selam]);
      return { kayitlar: [], ayarlar: sifirAyar, mesajlar: [selam] };
    },
  );
}

export async function restoreLatestBackup(): Promise<InitData | null> {
  const snapshot = await getLatestBackup();
  if (!snapshot) return null;
  return restoreSnapshot(snapshot);
}

export async function restoreSnapshot(snapshot: InitData): Promise<InitData> {
  const restoredKayitlar = snapshot.kayitlar.map((item) => {
    const date = String(item.tarih || "");
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error("Backup has an invalid entry date.");
    }
    const gelir = Number(item.gelir);
    const gider = Number(item.gider);
    if (!Number.isFinite(gelir) || !Number.isFinite(gider)) throw new Error("Backup has an invalid amount.");
    const katList = KATEGORILER as readonly string[];
    const kategori = (katList.includes(item.kategori) ? item.kategori : (KATEGORI_ESKI[item.kategori] ?? "Other")) as Kategori;
    return {
      id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.id) ? item.id : crypto.randomUUID(),
      tarih: date,
      aciklama: String(item.aciklama || "Entry"),
      kategori,
      gelir: round2(Math.max(0, gelir)),
      gider: round2(Math.max(0, gider)),
      odemeTipi: item.odemeTipi === "Kart" ? ("Kart" as const) : item.odemeTipi === "Havale" ? ("Havale" as const) : ("Nakit" as const),
      kasaEtkisi: round2(gelir - gider),
      olusturmaZamani: Number.isNaN(new Date(item.olusturmaZamani).getTime())
        ? new Date().toISOString()
        : new Date(item.olusturmaZamani).toISOString(),
    } satisfies Kayit;
  });
  const restoredAyarlar = snapshot.ayarlar;
  if (!Number.isFinite(Number(restoredAyarlar.kiraTutari)) || !Number.isFinite(Number(restoredAyarlar.acilisBakiyesi))) {
    throw new Error("Backup has invalid settings.");
  }
  const restoredMesajlar = snapshot.mesajlar.map((item) => ({
    id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.id) ? item.id : crypto.randomUUID(),
    rol: item.rol === "user" ? ("user" as const) : ("assistant" as const),
    icerik: String(item.icerik || ""),
    olusturmaZamani: Number.isNaN(new Date(item.olusturmaZamani).getTime())
      ? new Date().toISOString()
      : new Date(item.olusturmaZamani).toISOString(),
  }));

  const ayar = { ...restoredAyarlar, id: 1 };
  if (hasDatabase && db) {
    await ensureDefaults();
    await db.transaction(async (tx) => {
      await tx.delete(kayitlar);
      if (restoredKayitlar.length) {
        await tx.insert(kayitlar).values(
          restoredKayitlar.map((item) => ({
            id: item.id,
            tarih: item.tarih,
            aciklama: item.aciklama,
            kategori: item.kategori,
            gelir: item.gelir.toFixed(2),
            gider: item.gider.toFixed(2),
            odemeTipi: item.odemeTipi,
            kasaEtkisi: item.kasaEtkisi.toFixed(2),
            olusturmaZamani: new Date(item.olusturmaZamani),
          })),
        );
      }
      await tx.update(ayarlar).set({
        isletmeAdi: ayar.isletmeAdi,
        kiraTutari: Number(ayar.kiraTutari).toFixed(2),
        kiraPeriyodu: Number(ayar.kiraPeriyodu),
        aylikKiraKarsiligi: Number(ayar.aylikKiraKarsiligi).toFixed(2),
        paraBirimi: ayar.paraBirimi,
        kiraSonrakiTarih: ayar.kiraSonrakiTarih,
        acilisBakiyesi: Number(ayar.acilisBakiyesi).toFixed(2),
      }).where(eq(ayarlar.id, 1));
      await tx.delete(sohbetMesajlari);
      if (restoredMesajlar.length) {
        await tx.insert(sohbetMesajlari).values(
          restoredMesajlar.map((item) => ({ ...item, olusturmaZamani: new Date(item.olusturmaZamani) })),
        );
      }
    });
  }

  const data: InitData = { kayitlar: restoredKayitlar, ayarlar: ayar, mesajlar: restoredMesajlar };
  await fileSaveAll(data.kayitlar, data.ayarlar, data.mesajlar);
  return data;
}

export type { OdemeTipi };

/* ================= MÜŞTERİLER + ZİYARETLER (EGZEL ARYA modülü) ================= */

const DURUMLAR: ZiyaretDurum[] = ["hazirlaniyor", "hazir", "teslim"];

function gecerliDurum(d: unknown): ZiyaretDurum {
  return DURUMLAR.includes(d as ZiyaretDurum) ? (d as ZiyaretDurum) : "hazirlaniyor";
}

function kisa(s: unknown, enFazla: number): string {
  return String(s ?? "").trim().slice(0, enFazla);
}

function mapZiyaret(row: typeof ziyaretler.$inferSelect): Ziyaret {
  return {
    id: row.id,
    musteriId: row.musteriId,
    hizmet: row.hizmet,
    tutar: num(row.tutar),
    tarih: row.tarih,
    not: row.not,
    durum: gecerliDurum(row.durum),
    olusturmaZamani: row.olusturmaZamani.toISOString(),
  };
}

function mapMusteri(row: typeof musteriler.$inferSelect, tumZiyaretler: Ziyaret[]): Musteri {
  const zs = tumZiyaretler
    .filter((z) => z.musteriId === row.id)
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
  return {
    id: row.id,
    ad: row.ad,
    soyad: row.soyad,
    telefon: row.telefon,
    not: row.not,
    ziyaretSayisi: zs.length,
    toplamHarcama: round2(zs.reduce((s, z) => s + z.tutar, 0)),
    sonZiyaret: zs.length ? zs[0].tarih : null,
    silindi: row.silindiAt !== null,
    olusturmaZamani: row.olusturmaZamani.toISOString(),
  };
}

let musteriTabloHazir = false;

/** Yerel Postgres'te müşteri tablolarını idempotent kur (drizzle-kit gerektirmez). */
async function ensureMusteriTables(): Promise<void> {
  if (musteriTabloHazir || !hasDatabase || !pool) return;
  await pool.query(`
    create table if not exists musteriler (
      id uuid primary key,
      ad text not null,
      soyad text not null default '',
      telefon text not null default '',
      "not" text not null default '',
      silindi_at timestamp,
      olusturma_zamani timestamp not null
    );
    create table if not exists ziyaretler (
      id uuid primary key,
      musteri_id uuid not null,
      hizmet text not null default '',
      tutar numeric(14,2) not null default '0',
      tarih date not null,
      "not" text not null default '',
      durum varchar(20) not null default 'hazirlaniyor',
      olusturma_zamani timestamp not null
    );
    create index if not exists musteriler_telefon_idx on musteriler (telefon);
    create index if not exists ziyaretler_musteri_idx on ziyaretler (musteri_id);
  `);
  musteriTabloHazir = true;
}

type MusteriDosya = { musteriler: Musteri[]; ziyaretler: Ziyaret[] };

async function musteriDosyaOku(): Promise<MusteriDosya> {
  try {
    const raw = await nodeFs.readFile(path.join(getDataDir(), "musteriler.json"), "utf-8");
    const j = JSON.parse(raw) as Partial<MusteriDosya>;
    return {
      musteriler: Array.isArray(j.musteriler) ? j.musteriler : [],
      ziyaretler: Array.isArray(j.ziyaretler) ? j.ziyaretler : [],
    };
  } catch {
    return { musteriler: [], ziyaretler: [] };
  }
}

async function musteriDosyaYaz(d: MusteriDosya): Promise<void> {
  await nodeFs.mkdir(getDataDir(), { recursive: true });
  await nodeFs.writeFile(path.join(getDataDir(), "musteriler.json"), JSON.stringify(d), "utf-8");
}

function musteriSuz(musteriler: Musteri[], q?: string, silinmis = false): Musteri[] {
  let ms = silinmis ? musteriler : musteriler.filter((m) => !m.silindi);
  if (q) {
    const t = q.toLocaleLowerCase("tr");
    ms = ms.filter((m) => `${m.ad} ${m.soyad} ${m.telefon}`.toLocaleLowerCase("tr").includes(t));
  }
  return ms.sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr"));
}

export async function listMusteriler(q?: string, silinmis = false): Promise<Musteri[]> {
  return withDb(
    async () => {
      await ensureMusteriTables();
      const [mRows, zRows] = await Promise.all([db!.select().from(musteriler), db!.select().from(ziyaretler)]);
      const zs = zRows.map(mapZiyaret);
      return musteriSuz(mRows.map((r) => mapMusteri(r, zs)), q, silinmis);
    },
    async () => {
      const d = await musteriDosyaOku();
      return musteriSuz(d.musteriler, q, silinmis);
    },
  );
}

export async function getMusteri(id: string): Promise<(Musteri & { ziyaretler: Ziyaret[] }) | null> {
  return withDb(
    async () => {
      await ensureMusteriTables();
      const mRows = await db!.select().from(musteriler).where(eq(musteriler.id, id)).limit(1);
      if (!mRows.length) return null;
      const zRows = await db!.select().from(ziyaretler).where(eq(ziyaretler.musteriId, id));
      const zs = zRows.map(mapZiyaret).sort((a, b) => b.tarih.localeCompare(a.tarih));
      return { ...mapMusteri(mRows[0], zs), ziyaretler: zs };
    },
    async () => {
      const d = await musteriDosyaOku();
      const m = d.musteriler.find((x) => x.id === id);
      if (!m) return null;
      const zs = d.ziyaretler.filter((z) => z.musteriId === id).sort((a, b) => b.tarih.localeCompare(a.tarih));
      return { ...m, ziyaretSayisi: zs.length, toplamHarcama: round2(zs.reduce((s, z) => s + z.tutar, 0)), sonZiyaret: zs.length ? zs[0].tarih : null, ziyaretler: zs };
    },
  );
}

export async function createMusteri(input: MusteriGirdi): Promise<Musteri> {
  const ad = kisa(input.ad, 60) || "İsimsiz";
  const soyad = kisa(input.soyad, 60);
  const telefon = kisa(input.telefon, 30);
  const not = kisa(input.not, 500);
  return withDb(
    async () => {
      await ensureMusteriTables();
      const row = { id: crypto.randomUUID(), ad, soyad, telefon, not, silindiAt: null as Date | null, olusturmaZamani: new Date() };
      await db!.insert(musteriler).values(row);
      return mapMusteri({ ...row }, []);
    },
    async () => {
      const d = await musteriDosyaOku();
      const m: Musteri = { id: crypto.randomUUID(), ad, soyad, telefon, not, ziyaretSayisi: 0, toplamHarcama: 0, sonZiyaret: null, silindi: false, olusturmaZamani: new Date().toISOString() };
      d.musteriler.push(m);
      await musteriDosyaYaz(d);
      return m;
    },
  );
}

export async function updateMusteri(id: string, patch: Partial<MusteriGirdi>): Promise<Musteri | null> {
  return withDb(
    async () => {
      await ensureMusteriTables();
      const cur = await db!.select().from(musteriler).where(eq(musteriler.id, id)).limit(1);
      if (!cur.length) return null;
      const next = {
        ad: patch.ad !== undefined ? kisa(patch.ad, 60) || cur[0].ad : cur[0].ad,
        soyad: patch.soyad !== undefined ? kisa(patch.soyad, 60) : cur[0].soyad,
        telefon: patch.telefon !== undefined ? kisa(patch.telefon, 30) : cur[0].telefon,
        not: patch.not !== undefined ? kisa(patch.not, 500) : cur[0].not,
      };
      await db!.update(musteriler).set(next).where(eq(musteriler.id, id));
      const zRows = await db!.select().from(ziyaretler).where(eq(ziyaretler.musteriId, id));
      return mapMusteri({ ...cur[0], ...next }, zRows.map(mapZiyaret));
    },
    async () => {
      const d = await musteriDosyaOku();
      const m = d.musteriler.find((x) => x.id === id);
      if (!m) return null;
      if (patch.ad !== undefined) m.ad = kisa(patch.ad, 60) || m.ad;
      if (patch.soyad !== undefined) m.soyad = kisa(patch.soyad, 60);
      if (patch.telefon !== undefined) m.telefon = kisa(patch.telefon, 30);
      if (patch.not !== undefined) m.not = kisa(patch.not, 500);
      await musteriDosyaYaz(d);
      return getMusteri(id).then((g) => (g ? { ...g, ziyaretler: undefined as never } as Musteri : null));
    },
  );
}

async function setMusteriSilindi(id: string, silindi: boolean): Promise<boolean> {
  return withDb(
    async () => {
      await ensureMusteriTables();
      const r = await db!.update(musteriler).set({ silindiAt: silindi ? new Date() : null }).where(eq(musteriler.id, id)).returning({ id: musteriler.id });
      return r.length > 0;
    },
    async () => {
      const d = await musteriDosyaOku();
      const m = d.musteriler.find((x) => x.id === id);
      if (!m) return false;
      m.silindi = silindi;
      await musteriDosyaYaz(d);
      return true;
    },
  );
}

export async function deleteMusteri(id: string): Promise<boolean> {
  return setMusteriSilindi(id, true);
}

export async function restoreMusteri(id: string): Promise<boolean> {
  return setMusteriSilindi(id, false);
}

export async function addZiyaret(input: ZiyaretGirdi): Promise<Ziyaret> {
  const hizmet = kisa(input.hizmet, 80);
  const tutar = round2(Math.max(0, Number(input.tutar) || 0));
  const tarih = gecerliTarih(input.tarih);
  const not = kisa(input.not, 500);
  return withDb(
    async () => {
      await ensureMusteriTables();
      const row = { id: crypto.randomUUID(), musteriId: input.musteriId, hizmet, tutar: tutar.toFixed(2), tarih, not, durum: "hazirlaniyor", olusturmaZamani: new Date() };
      await db!.insert(ziyaretler).values(row);
      return mapZiyaret({ ...row });
    },
    async () => {
      const d = await musteriDosyaOku();
      const z: Ziyaret = { id: crypto.randomUUID(), musteriId: input.musteriId, hizmet, tutar, tarih, not, durum: "hazirlaniyor", olusturmaZamani: new Date().toISOString() };
      d.ziyaretler.push(z);
      const m = d.musteriler.find((x) => x.id === input.musteriId);
      if (m) {
        const zs = d.ziyaretler.filter((x) => x.musteriId === m.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
        m.ziyaretSayisi = zs.length;
        m.toplamHarcama = round2(zs.reduce((s, x) => s + x.tutar, 0));
        m.sonZiyaret = zs.length ? zs[0].tarih : null;
      }
      await musteriDosyaYaz(d);
      return z;
    },
  );
}

export async function updateZiyaretDurum(id: string, durum: ZiyaretDurum): Promise<Ziyaret | null> {
  const d = gecerliDurum(durum);
  return withDb(
    async () => {
      await ensureMusteriTables();
      const r = await db!.update(ziyaretler).set({ durum: d }).where(eq(ziyaretler.id, id)).returning();
      if (!r.length) return null;
      return mapZiyaret(r[0]);
    },
    async () => {
      const dosya = await musteriDosyaOku();
      const z = dosya.ziyaretler.find((x) => x.id === id);
      if (!z) return null;
      z.durum = d;
      await musteriDosyaYaz(dosya);
      return z;
    },
  );
}

export async function deleteZiyaret(id: string): Promise<boolean> {
  return withDb(
    async () => {
      await ensureMusteriTables();
      const r = await db!.delete(ziyaretler).where(eq(ziyaretler.id, id)).returning({ id: ziyaretler.id });
      return r.length > 0;
    },
    async () => {
      const dosya = await musteriDosyaOku();
      const once = dosya.ziyaretler.length;
      dosya.ziyaretler = dosya.ziyaretler.filter((x) => x.id !== id);
      if (dosya.ziyaretler.length === once) return false;
      await musteriDosyaYaz(dosya);
      return true;
    },
  );
}

/** Hızlı ekleme: telefon/adla eşleşen müşteriyi bul ya da aç, ziyareti işle. */
export async function hizliMusteriEkle(input: MusteriGirdi & { hizmet?: string; tutar?: number; tarih?: string; musteriId?: string }): Promise<{ musteri: Musteri; ziyaret: Ziyaret | null; eslesti: boolean }> {
  const tum = await listMusteriler(undefined, true);
  const tel = kisa(input.telefon, 30);
  let m: Musteri | undefined;
  if (input.musteriId) m = tum.find((x) => x.id === input.musteriId && !x.silindi);
  if (!m && tel) m = tum.find((x) => !x.silindi && x.telefon === tel);
  if (!m) {
    const adKucuk = kisa(input.ad, 60).toLocaleLowerCase("tr");
    const soyKucuk = kisa(input.soyad, 60).toLocaleLowerCase("tr");
    if (adKucuk) m = tum.find((x) => !x.silindi && x.ad.toLocaleLowerCase("tr") === adKucuk && x.soyad.toLocaleLowerCase("tr") === soyKucuk);
  }
  const eslesti = Boolean(m);
  const musteri = m ?? (await createMusteri(input));
  let ziyaret: Ziyaret | null = null;
  if (kisa(input.hizmet, 80) || Number(input.tutar) > 0) {
    ziyaret = await addZiyaret({ musteriId: musteri.id, hizmet: kisa(input.hizmet, 80), tutar: Number(input.tutar) || 0, tarih: input.tarih || toISODate(), not: "" });
  }
  const guncel = await getMusteri(musteri.id);
  return { musteri: guncel ? { ...guncel, ziyaretler: undefined as never } as Musteri : musteri, ziyaret, eslesti };
}

