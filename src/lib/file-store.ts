import { promises as fs } from "node:fs";
import path from "node:path";
import type { Ayarlar, Kayit, SohbetMesaji } from "./types";
import { addDays, addMonths, round2, toISODate } from "./format";

/**
 * Dosya tabanlı kalıcı hafıza.
 * Postgres yoksa veya erişilemezse devreye girer.
 *
 * VERİ NEREDE? Proje klasörünün DIŞINDA:
 *   1. VERILER_DIZIN ortam değişkeni (varsa)
 *   2. %APPDATA%/MgroqDefter/data (Windows varsayılanı)
 *   3. <proje>/data (son çare)
 * Böylece proje klasörü silinse / güncellenip değişse bile veriler korunur.
 * Eski <proje>/data içindeki veriler ilk açılışta otomatik taşınır.
 *
 * GÜVENLİK KATMANLARI:
 *  - Atomik yazım (tmp + rename) + her yazımda .bak kopyası
 *  - Günlük otomatik yedek (yedekler/yedek-GG.AA.YYYY.json, 90 gün)
 *  - DB varsa dosyaya ayna + tarayıcı localStorage (istemci tarafı)
 */

const APP_ADI = "Defterdar";
const ESKI_APP_ADI = "MgroqDefter"; // eski klasörden otomatik taşıma için

function appDataDir(): string | null {
  const appData =
    process.env.APPDATA ||
    (process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "AppData", "Roaming")
      : null);
  if (!appData) return null;
  return path.join(appData, APP_ADI, "data");
}

function legacyDir(): string {
  return path.join(process.cwd(), "data");
}

/** Birincil veri klasörü (dışarıda). */
export function getDataDir(): string {
  if (process.env.VERILER_DIZIN) return process.env.VERILER_DIZIN;
  return appDataDir() ?? legacyDir();
}

export function getBackupDir(): string {
  return path.join(getDataDir(), "yedekler");
}

export async function getLatestBackup(): Promise<{ kayitlar: Kayit[]; ayarlar: Ayarlar; mesajlar: SohbetMesaji[] } | null> {
  await ensureDirs();
  const files = (await fs.readdir(backupDir()).catch(() => []))
    .filter((file) => /^yedek-\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .reverse();
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(backupDir(), file), "utf-8");
      const data = JSON.parse(raw) as Partial<{ kayitlar: Kayit[]; ayarlar: Ayarlar; mesajlar: SohbetMesaji[] }>;
      if (Array.isArray(data.kayitlar) && data.ayarlar && typeof data.ayarlar === "object") {
        return {
          kayitlar: data.kayitlar,
          ayarlar: data.ayarlar,
          mesajlar: Array.isArray(data.mesajlar) ? data.mesajlar : [],
        };
      }
    } catch {
      // Bozuk en yeni yedek varsa sıradaki sağlam yedeği dene.
    }
  }
  return null;
}

function backupDir(): string {
  return getBackupDir();
}

function dataDir(): string {
  return getDataDir();
}

let migratePromise: Promise<void> | null = null;

/** Eski konumlar (otomatik taşıma kaynakları): önce eski APPDATA, sonra proje-içi */
function eskiDizinler(): string[] {
  const list: string[] = [];
  const appData =
    process.env.APPDATA ||
    (process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "AppData", "Roaming")
      : null);
  if (appData) list.push(path.join(appData, ESKI_APP_ADI, "data"));
  list.push(legacyDir());
  return list.filter((d) => d !== getDataDir());
}

/** Eski veriyi dış klasöre bir kez otomatik taşı. */
function migrateOnce(): Promise<void> {
  if (!migratePromise) {
    migratePromise = (async () => {
      const hedef = getDataDir();
      try {
        // Hedefte zaten veri varsa taşıma (kullanıcı verisi öncelikli)
        try {
          await fs.access(path.join(hedef, "kayitlar.json"));
          return;
        } catch {
          /* hedef boş, devam */
        }
        for (const kaynak of eskiDizinler()) {
          try {
            await fs.access(path.join(kaynak, "kayitlar.json"));
          } catch {
            continue; // bu kaynakta veri yok, sonrakine bak
          }
          await fs.mkdir(hedef, { recursive: true });
          for (const dosya of ["kayitlar.json", "ayarlar.json", "sohbet.json"]) {
            try {
              await fs.copyFile(path.join(kaynak, dosya), path.join(hedef, dosya));
            } catch {
              /* tekil dosya hatası taşımayı durdurmasın */
            }
          }
          // Eski yedekleri de taşı
          try {
            const yedekKaynak = path.join(kaynak, "yedekler");
            const yedekHedef = path.join(hedef, "yedekler");
            await fs.mkdir(yedekHedef, { recursive: true });
            const files = await fs.readdir(yedekKaynak);
            for (const f of files) {
              try {
                await fs.copyFile(path.join(yedekKaynak, f), path.join(yedekHedef, f));
              } catch {
                /* geç */
              }
            }
          } catch {
            /* yedek klasörü yoksa sorun değil */
          }
          console.log(`[hafiza] Eski veriler taşındı: ${kaynak} -> ${hedef}`);
          return;
        }
      } catch (e) {
        console.warn("[hafiza] Otomatik taşıma atlandı:", (e as Error)?.message);
      }
    })();
  }
  return migratePromise;
}

async function ensureDirs() {
  await migrateOnce();
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.mkdir(backupDir(), { recursive: true });
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(dataDir(), name), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(name: string, value: unknown): Promise<void> {
  await ensureDirs();
  const full = path.join(dataDir(), name);
  const tmp = `${full}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf-8");
  // Üzerine yazmadan önce son sağlam kopyayı .bak olarak sakla
  // (güncelleme/crash anında yarım yazıma karşı)
  try {
    await fs.access(full);
    await fs.copyFile(full, `${full}.bak`);
  } catch {
    /* ilk yazım, yedeklenecek eski dosya yok */
  }
  await fs.rename(tmp, full);
  // Her yazımda hafif yedek (günde 1 kez tam yedek)
  await maybeDailyBackup().catch(() => undefined);
}

let lastBackupDay = "";
async function maybeDailyBackup() {
  const today = toISODate();
  if (lastBackupDay === today) return;
  lastBackupDay = today;
  try {
    const [kayitlar, ayarlar, mesajlar] = await Promise.all([
      readJson("kayitlar.json", null as unknown),
      readJson("ayarlar.json", null as unknown),
      readJson("sohbet.json", null as unknown),
    ]);
    if (!kayitlar && !ayarlar) return;
    const file = path.join(backupDir(), `yedek-${today}.json`);
    try {
      await fs.access(file);
      return; // bugün zaten yedek var
    } catch {
      /* yoksa yaz */
    }
    await fs.writeFile(
      file,
      JSON.stringify({ tarih: new Date().toISOString(), kayitlar, ayarlar, mesajlar }, null, 2),
      "utf-8",
    );
    // 90 günden eski yedekleri temizle
    const files = await fs.readdir(backupDir()).catch(() => [] as string[]);
    const yedekler = files.filter((f) => f.startsWith("yedek-")).sort();
    while (yedekler.length > 90) {
      const eski = yedekler.shift();
      if (eski) await fs.unlink(path.join(backupDir(), eski)).catch(() => undefined);
    }
  } catch {
    /* yedek hatası sessiz geç */
  }
}

function seedAyarlar(today: string): Ayarlar {
  return {
    id: 1,
    isletmeAdi: "Mavi Dükkan Defteri",
    kiraTutari: 150000,
    kiraPeriyodu: 6,
    aylikKiraKarsiligi: 25000,
    paraBirimi: "TL",
    kiraSonrakiTarih: addMonths(today, 1).slice(0, 8) + "01",
    acilisBakiyesi: 12500,
    aiMotor: "otomatik",
    ollamaModel: "gemma3:4b",
    whatsappAlici: "0556102095",
  };
}

function seedKayitlar(today: string): Kayit[] {
  const d = (offset: number) => addDays(today, offset);
  const ham: Array<[string, string, Kayit["kategori"], number, number, Kayit["odemeTipi"]]> = [
    [d(-12), "Açılış nakit hizmet", "Hizmet", 8200, 0, "Nakit"],
    [d(-12), "Kartlı hizmet", "Hizmet", 4650, 0, "Kart"],
    [d(-11), "Market alışverişi", "Market", 0, 890, "Nakit"],
    [d(-10), "Günlük hizmet", "Hizmet", 7100, 0, "Nakit"],
    [d(-10), "Su faturası", "Su", 0, 420, "Kart"],
    [d(-8), "Elektrik faturası", "Elektrik", 0, 1250, "Kart"],
    [d(-7), "Hafta sonu hizmet", "Hizmet", 9800, 0, "Nakit"],
    [d(-7), "Kartlı hizmet", "Hizmet", 5400, 0, "Kart"],
    [d(-6), "Doğalgaz faturası", "Doğalgaz", 0, 1875, "Kart"],
    [d(-5), "Dükkan temizlik malzemesi", "İş Yeri", 0, 340, "Nakit"],
    [d(-4), "Günlük hizmet", "Hizmet", 6400, 0, "Nakit"],
    [d(-3), "Ev market", "Ev", 0, 560, "Kart"],
    [d(-2), "Günlük hizmet", "Hizmet", 7300, 0, "Nakit"],
    [d(-2), "Kartlı hizmet", "Hizmet", 3900, 0, "Kart"],
    [d(-1), "Elektrik ek ödeme", "Elektrik", 0, 380, "Nakit"],
    [today, "Sabah nakit hizmet", "Hizmet", 2750, 0, "Nakit"],
    [today, "Öğleden sonra kartlı hizmet", "Hizmet", 1680, 0, "Kart"],
  ];
  const now = new Date().toISOString();
  return ham.map(([tarih, aciklama, kategori, gelir, gider, odemeTipi]) => ({
    id: crypto.randomUUID(),
    tarih,
    aciklama,
    kategori,
    gelir,
    gider,
    odemeTipi,
    kasaEtkisi: round2(gelir - gider),
    olusturmaZamani: now,
  }));
}

function seedMesaj(): SohbetMesaji[] {
  return [
    {
      id: crypto.randomUUID(),
      rol: "assistant",
      icerik:
        "Merhaba, ben Defterdar — dijital muhasebeciniz. Deftere doğal dille kayıt girebilirim, gün sonu ve Z raporu hazırlarım.\n\nÖrnekler:\n• \"Bugün 5.000 TL nakit hizmet yaptım\"\n• \"12.03.2024 tarihinde 2.000 TL kart hizmet\" (geçmişe de yazabilirsiniz)\n• \"Elektrik faturası 1.250 TL kart ile ödedim\"\n• \"Bu ayın kar-zarar durumu ne?\"\n• \"1-15 arası Z raporu al\"",
      olusturmaZamani: new Date().toISOString(),
    },
  ];
}

export async function fileGetAll(): Promise<{ kayitlar: Kayit[]; ayarlar: Ayarlar; mesajlar: SohbetMesaji[] }> {
  await ensureDirs();
  const today = toISODate();
  let kayitlar = await readJson<Kayit[] | null>("kayitlar.json", null);
  let ayarlar = await readJson<Ayarlar | null>("ayarlar.json", null);
  let mesajlar = await readJson<SohbetMesaji[] | null>("sohbet.json", null);

  let yaz = false;
  if (!ayarlar) {
    ayarlar = seedAyarlar(today);
    yaz = true;
  } else if (!ayarlar.aiMotor || !ayarlar.ollamaModel || !ayarlar.whatsappAlici) {
    // Eski dosyada yeni alanlar yoksa ezmeden tamamla.
    if (!ayarlar.aiMotor) ayarlar.aiMotor = "otomatik";
    if (!ayarlar.ollamaModel) ayarlar.ollamaModel = "gemma3:4b";
    if (!ayarlar.whatsappAlici) ayarlar.whatsappAlici = "0556102095";
    yaz = true;
  }
  if (!kayitlar) {
    kayitlar = seedKayitlar(today);
    yaz = true;
  }
  if (!mesajlar) {
    mesajlar = seedMesaj();
    yaz = true;
  }
  if (yaz) {
    await Promise.all([
      writeJsonAtomic("kayitlar.json", kayitlar),
      writeJsonAtomic("ayarlar.json", ayarlar),
      writeJsonAtomic("sohbet.json", mesajlar),
    ]);
  }
  const sirali = [...kayitlar].sort((a, b) => a.tarih.localeCompare(b.tarih));
  // Sohbet hafızası: son 200 mesaj korunur (önceden 80 idi)
  const sonMesajlar = mesajlar.slice(-200);
  return { kayitlar: sirali, ayarlar, mesajlar: sonMesajlar };
}

export async function fileSaveAll(
  kayitlar: Kayit[],
  ayarlar: Ayarlar,
  mesajlar: SohbetMesaji[],
): Promise<void> {
  // Sohbeti 500 mesajda buda (hafıza şişmesin ama kaybolmasın)
  const kirpilmis = mesajlar.slice(-500);
  await Promise.all([
    writeJsonAtomic("kayitlar.json", kayitlar),
    writeJsonAtomic("ayarlar.json", ayarlar),
    writeJsonAtomic("sohbet.json", kirpilmis),
  ]);
}

export async function fileSaveKayitlar(kayitlar: Kayit[]): Promise<void> {
  await writeJsonAtomic("kayitlar.json", kayitlar);
}

export async function fileSaveAyarlar(ayarlar: Ayarlar): Promise<void> {
  await writeJsonAtomic("ayarlar.json", ayarlar);
}

export async function fileSaveMesajlar(mesajlar: SohbetMesaji[]): Promise<void> {
  await writeJsonAtomic("sohbet.json", mesajlar.slice(-500));
}

/** Ayna: DB başarılı olduğunda dosyaya da yedekle (çift katman). */
export async function mirrorToFile(
  kayitlar: Kayit[],
  ayarlar: Ayarlar,
  mesajlar?: SohbetMesaji[],
): Promise<void> {
  try {
    await ensureDirs();
    // Sessiz ayna: günlük yedeği tetiklemeden hızlı yaz
    await Promise.all([
      fs.writeFile(path.join(dataDir(), "kayitlar.json"), JSON.stringify(kayitlar, null, 2), "utf-8").catch(() => undefined),
      fs.writeFile(path.join(dataDir(), "ayarlar.json"), JSON.stringify(ayarlar, null, 2), "utf-8").catch(() => undefined),
      ...(mesajlar
        ? [
            fs
              .writeFile(path.join(dataDir(), "sohbet.json"), JSON.stringify(mesajlar.slice(-500), null, 2), "utf-8")
              .catch(() => undefined),
          ]
        : []),
    ]);
  } catch {
    /* ayna hatası kritik değil */
  }
}

export async function hafizaDurumu(): Promise<{
  mod: "postgres" | "dosya";
  kayitSayisi: number;
  mesajSayisi: number;
  yedekSayisi: number;
  sonYedek: string | null;
  veriKlasoru: string;
  groqAktif: boolean;
}> {
  const { kayitlar, mesajlar } = await fileGetAll().catch(() => ({ kayitlar: [] as Kayit[], mesajlar: [] as SohbetMesaji[] }));
  let yedekSayisi = 0;
  let sonYedek: string | null = null;
  try {
    const files = await fs.readdir(backupDir());
    const yedekler = files.filter((f) => f.startsWith("yedek-")).sort();
    yedekSayisi = yedekler.length;
    sonYedek = yedekler.length ? yedekler[yedekler.length - 1] : null;
  } catch {
    yedekSayisi = 0;
  }
  const { hasDatabase } = await import("@/db");
  return {
    mod: hasDatabase ? "postgres" : "dosya",
    kayitSayisi: kayitlar.length,
    mesajSayisi: mesajlar.length,
    yedekSayisi,
    sonYedek,
    veriKlasoru: dataDir(),
    groqAktif: Boolean(process.env.GROQ_API_KEY),
  };
}
