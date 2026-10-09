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

const APP_ADI = "TailorLedger";
const ESKI_APP_ADI = "Defterdar"; // migrate once from old folder

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

/** Old locations (auto-migrate sources): previous APPDATA dirs, then project dir */
function eskiDizinler(): string[] {
  const list: string[] = [];
  const appData =
    process.env.APPDATA ||
    (process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "AppData", "Roaming")
      : null);
  if (appData) {
    list.push(path.join(appData, ESKI_APP_ADI, "data"));
    list.push(path.join(appData, "MgroqDefter", "data"));
  }
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
  // Eşzamanlı yazımlar çakışmasın diye benzersiz tmp adı (aynı pid'den çift istek gelebilir)
  const tmp = `${full}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf-8");
  // Üzerine yazmadan önce son sağlam kopyayı .bak olarak sakla
  // (güncelleme/crash anında yarım yazıma karşı)
  try {
    await fs.access(full);
    await fs.copyFile(full, `${full}.bak`);
  } catch {
    /* ilk yazım, yedeklenecek eski dosya yok */
  }
  // Antivirüs anlık kilitlerine karşı: birkaç kez dene, olmazsa düz yazıma düş
  let yazildi = false;
  for (let deneme = 0; deneme < 4 && !yazildi; deneme += 1) {
    try {
      await fs.rename(tmp, full);
      yazildi = true;
    } catch (err) {
      if (deneme === 3) {
        console.warn(`[hafiza] rename olmadı, düz yazım: ${name} (${(err as Error)?.message})`);
        await fs.writeFile(full, JSON.stringify(value, null, 2), "utf-8");
        yazildi = true;
      } else {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }
  try {
    await fs.unlink(tmp).catch(() => undefined);
  } catch { /* ignore */ }
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
    isletmeAdi: "My Shop",
    kiraTutari: 1500,
    kiraPeriyodu: 6,
    aylikKiraKarsiligi: 250,
    paraBirimi: "USD",
    kiraSonrakiTarih: addMonths(today, 1).slice(0, 8) + "01",
    acilisBakiyesi: 125,
    aiMotor: "otomatik",
    ollamaModel: "gemma3:4b",
    whatsappAlici: "",
  };
}

function seedKayitlar(today: string): Kayit[] {
  const d = (offset: number) => addDays(today, offset);
  const ham: Array<[string, string, Kayit["kategori"], number, number, Kayit["odemeTipi"]]> = [
    [d(-12), "Opening cash service", "Service", 82, 0, "Nakit"],
    [d(-12), "Card service", "Service", 46.5, 0, "Kart"],
    [d(-11), "Supply store", "Groceries", 0, 8.9, "Nakit"],
    [d(-10), "Daily service", "Service", 71, 0, "Nakit"],
    [d(-10), "Water bill", "Water", 0, 4.2, "Kart"],
    [d(-8), "Electricity bill", "Utilities", 0, 12.5, "Kart"],
    [d(-7), "Weekend service", "Service", 98, 0, "Nakit"],
    [d(-7), "Card service", "Service", 54, 0, "Kart"],
    [d(-6), "Heating bill", "Heating", 0, 18.75, "Kart"],
    [d(-5), "Shop cleaning supplies", "Workshop", 0, 3.4, "Nakit"],
    [d(-4), "Daily service", "Service", 64, 0, "Nakit"],
    [d(-3), "Home groceries", "Home", 0, 5.6, "Kart"],
    [d(-2), "Daily service", "Service", 73, 0, "Nakit"],
    [d(-2), "Card service", "Service", 39, 0, "Kart"],
    [d(-1), "Extra electricity", "Utilities", 0, 3.8, "Nakit"],
    [today, "Morning cash service", "Service", 27.5, 0, "Nakit"],
    [today, "Afternoon card service", "Service", 16.8, 0, "Kart"],
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
        "Hello, I'm LedgerAI — your shop assistant. Add entries in natural language, get day close and Z reports.\n\nExamples:\n• \"Today cash service $50\"\n• \"March 12 card service $20\"\n• \"Paid electricity $12.50 by card\"\n• \"This month's profit and loss?\"\n• \"Z report 1-15\"",
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
    if (!ayarlar.whatsappAlici) ayarlar.whatsappAlici = "";
    yaz = true;
  }
  // Eski Türkçe varsayılan işletme adı → İngilizce (kullanıcı ayarlardan değiştirebilir).
  if (ayarlar.isletmeAdi === "Mavi Dükkan Defteri" || ayarlar.isletmeAdi === "Mavi Defter Dükkanı") {
    ayarlar = { ...ayarlar, isletmeAdi: "My Shop" };
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
