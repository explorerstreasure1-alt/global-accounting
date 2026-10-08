import { desc, eq } from "drizzle-orm";
import { db, hasDatabase } from "@/db";
import { ayarlar, kayitlar, sohbetMesajlari } from "@/db/schema";
import type { Ayarlar, InitData, Kayit, KayitGirdi, Kategori, OdemeTipi, SohbetMesaji } from "./types";
import { addDays, addMonths, num, round2, toISODate } from "./format";
import { KATEGORILER } from "./types";
import {
  fileGetAll,
  fileSaveAll,
  fileSaveAyarlar,
  fileSaveKayitlar,
  fileSaveMesajlar,
  getLatestBackup,
  mirrorToFile,
} from "./file-store";

function mapKayit(row: typeof kayitlar.$inferSelect): Kayit {
  const kategori = (KATEGORILER as readonly string[]).includes(row.kategori)
    ? (row.kategori as Kategori)
    : "Diğer";
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
    whatsappAlici: typeof raw.whatsappAlici === "string" && raw.whatsappAlici.trim() ? raw.whatsappAlici.trim() : "0556102095",
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
    { tarih: d(-12), aciklama: "Açılış nakit hizmet", kategori: "Hizmet", gelir: 8200, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-12), aciklama: "Kartlı hizmet", kategori: "Hizmet", gelir: 4650, gider: 0, odemeTipi: "Kart" },
    { tarih: d(-11), aciklama: "Market alışverişi", kategori: "Market", gelir: 0, gider: 890, odemeTipi: "Nakit" },
    { tarih: d(-10), aciklama: "Günlük hizmet", kategori: "Hizmet", gelir: 7100, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-10), aciklama: "Su faturası", kategori: "Su", gelir: 0, gider: 420, odemeTipi: "Kart" },
    { tarih: d(-8), aciklama: "Elektrik faturası", kategori: "Elektrik", gelir: 0, gider: 1250, odemeTipi: "Kart" },
    { tarih: d(-7), aciklama: "Hafta sonu hizmet", kategori: "Hizmet", gelir: 9800, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-7), aciklama: "Kartlı hizmet", kategori: "Hizmet", gelir: 5400, gider: 0, odemeTipi: "Kart" },
    { tarih: d(-6), aciklama: "Doğalgaz faturası", kategori: "Doğalgaz", gelir: 0, gider: 1875, odemeTipi: "Kart" },
    { tarih: d(-5), aciklama: "Dükkan temizlik malzemesi", kategori: "İş Yeri", gelir: 0, gider: 340, odemeTipi: "Nakit" },
    { tarih: d(-4), aciklama: "Günlük hizmet", kategori: "Hizmet", gelir: 6400, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-3), aciklama: "Ev market", kategori: "Ev", gelir: 0, gider: 560, odemeTipi: "Kart" },
    { tarih: d(-2), aciklama: "Günlük hizmet", kategori: "Hizmet", gelir: 7300, gider: 0, odemeTipi: "Nakit" },
    { tarih: d(-2), aciklama: "Kartlı hizmet", kategori: "Hizmet", gelir: 3900, gider: 0, odemeTipi: "Kart" },
    { tarih: d(-1), aciklama: "Elektrik ek ödeme", kategori: "Elektrik", gelir: 0, gider: 380, odemeTipi: "Nakit" },
    { tarih: today, aciklama: "Sabah nakit hizmet", kategori: "Hizmet", gelir: 2750, gider: 0, odemeTipi: "Nakit" },
    { tarih: today, aciklama: "Öğleden sonra kartlı hizmet", kategori: "Hizmet", gelir: 1680, gider: 0, odemeTipi: "Kart" },
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
        isletmeAdi: "Mavi Dükkan Defteri",
        kiraTutari: "150000.00",
        kiraPeriyodu: 6,
        aylikKiraKarsiligi: "25000.00",
        paraBirimi: "TL",
        kiraSonrakiTarih: addMonths(today, 1).slice(0, 8) + "01",
        acilisBakiyesi: "12500.00",
        aiMotor: "otomatik",
        ollamaModel: "gemma3:4b",
        whatsappAlici: "0556102095",
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
          "Merhaba, ben Defterdar — dijital muhasebeciniz. Deftere doğal dille kayıt girebilirim, gün sonu ve Z raporu hazırlarım.\n\nÖrnekler:\n• \"Bugün 5.000 TL nakit hizmet yaptım\"\n• \"Elektrik faturası 1.250 TL kart ile ödedim\"\n• \"Bu ayın kar-zarar durumu ne?\"\n• \"1-15 arası Z raporu al\"",
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
        aciklama: input.aciklama.trim() || "Kayıt",
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
        aciklama: input.aciklama.trim() || "Kayıt",
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
        ? patch.whatsappAlici.trim() || "0556102095"
        : (current.whatsappAlici || "0556102095"),
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

const TEMIZ_SELAMLAMA =
  "Sohbet temizlendi. 🧹 Ben Defterdar, dijital muhasebeciniz. Nasıl yardımcı olayım?";

/** Sohbeti temizle: eski mesajlar gider, selamlama kalır. Kayıtlara dokunulmaz. */
export async function temizleSohbet(): Promise<SohbetMesaji[]> {
  const selam: SohbetMesaji = {
    id: crypto.randomUUID(),
    rol: "assistant",
    icerik: TEMIZ_SELAMLAMA,
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
    kategori: "Diğer",
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
      "Defter sıfırlandı, tertemiz başlıyoruz. 🧹\n\nKayıtlar silindi, açılış bakiyesi ve kira sıfırlandı.\n\nÖrnekler:\n• \"Bugün 5.000 TL nakit hizmet yaptım\"\n• \"12.03.2024 tarihinde 2.000 TL kart hizmet\" (geçmişe de yazabilirsiniz)\n• \"Ay sonu al\" / \"Gün sonu al\"",
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
      throw new Error("Yedekte geçersiz kayıt tarihi var.");
    }
    const gelir = Number(item.gelir);
    const gider = Number(item.gider);
    if (!Number.isFinite(gelir) || !Number.isFinite(gider)) throw new Error("Yedekte geçersiz tutar var.");
    const kategori = (KATEGORILER as readonly string[]).includes(item.kategori) ? item.kategori : "Diğer";
    return {
      id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.id) ? item.id : crypto.randomUUID(),
      tarih: date,
      aciklama: String(item.aciklama || "Kayıt"),
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
    throw new Error("Yedekte geçersiz ayar bilgisi var.");
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
