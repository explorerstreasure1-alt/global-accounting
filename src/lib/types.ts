export const KATEGORILER = [
  "Rent",
  "Utilities",
  "Water",
  "Heating",
  "Home",
  "Workshop",
  "Service",
  "Groceries",
  "Other",
] as const;

/** Old Turkish values → English (backward compat for existing rows). */
export const KATEGORI_ESKI: Record<string, string> = {
  Kira: "Rent",
  Elektrik: "Utilities",
  Su: "Water",
  "Doğalgaz": "Heating",
  Ev: "Home",
  "İş Yeri": "Workshop",
  Hizmet: "Service",
  Market: "Groceries",
  "Diğer": "Other",
};

export type Kategori = (typeof KATEGORILER)[number];
export type OdemeTipi = "Nakit" | "Kart" | "Havale";

export type Kayit = {
  id: string;
  tarih: string;
  aciklama: string;
  kategori: Kategori;
  gelir: number;
  gider: number;
  odemeTipi: OdemeTipi;
  kasaEtkisi: number;
  olusturmaZamani: string;
};

export type KayitGirdi = {
  tarih: string;
  aciklama: string;
  kategori: Kategori;
  gelir: number;
  gider: number;
  odemeTipi: OdemeTipi;
};

export type Ayarlar = {
  id: number;
  isletmeAdi: string;
  kiraTutari: number;
  kiraPeriyodu: number;
  aylikKiraKarsiligi: number;
  paraBirimi: string;
  kiraSonrakiTarih: string | null;
  acilisBakiyesi: number;
  /** AI engine: otomatik (Groq + local), groq (all Groq), ollama (local first) */
  aiMotor: "otomatik" | "groq" | "ollama";
  /** Ollama modeli (ör. gemma3:4b). Ollama kapalıysa Groq devreye girer. */
  ollamaModel: string;
  /** WhatsApp rapor alıcısı (örn. 0556102095). */
  whatsappAlici: string;
  /** İşletmenin WhatsApp numarası (mesajlar bu hesaptan gider). */
  whatsappIsletme: string;
  /** Otomatik WA mesajı: sipariş alındı (boşsa dil varsayılanı). */
  waSablonAlindi: string;
  /** Otomatik WA mesajı: hazır (boşsa dil varsayılanı). */
  waSablonHazir: string;
  /** Google yorum linki (yıldız düğmesi için). */
  googleYorumLink: string;
};

export type SohbetMesaji = {
  id: string;
  rol: "user" | "assistant";
  icerik: string;
  olusturmaZamani: string;
};

export type InitData = {
  kayitlar: Kayit[];
  ayarlar: Ayarlar;
  mesajlar: SohbetMesaji[];
};

export type ChatAction =
  | { type: "open_calendar" }
  | { type: "open_settings" }
  | { type: "choose_backup_file" }
  | { type: "download_backup" }
  | { type: "download_excel"; tip: string; baslangic: string; bitis: string }
  | { type: "print_page" }
  | { type: "open_tab"; tab: "defter" | "asistan" }
  | { type: "navigate_month"; year: number; month: number }
  | { type: "navigate_date"; date: string }
  | { type: "open_report"; report: "z" | "day" | "month"; baslangic?: string; bitis?: string };

export type KategoriOzet = {
  kategori: string;
  gelir: number;
  gider: number;
  net: number;
  adet: number;
};

export type GunlukOzet = {
  tarih: string;
  gelir: number;
  gider: number;
  net: number;
  nakitGelir: number;
  nakitGider: number;
  kartGelir: number;
  kartGider: number;
  havaleGelir: number;
  havaleGider: number;
  adet: number;
};

export type RaporOzet = {
  baslangic: string;
  bitis: string;
  adet: number;
  gelir: number;
  gider: number;
  net: number;
  nakitGelir: number;
  nakitGider: number;
  nakitNet: number;
  kartGelir: number;
  kartGider: number;
  kartNet: number;
  havaleGelir: number;
  havaleGider: number;
  havaleNet: number;
  genelToplam: number;
  acilisBakiyesi: number;
  kapanisBakiyesi: number;
  kategoriler: KategoriOzet[];
  gunler: GunlukOzet[];
  kayitlar: Kayit[];
};

export type Uyari = {
  tip: "dikkat" | "bilgi" | "kritik";
  baslik: string;
  mesaj: string;
};

/** Ziyaret durumu: hazırlanıyor → hazır → teslim edildi */
export type ZiyaretDurum = "hazirlaniyor" | "hazir" | "teslim";

export type Musteri = {
  id: string;
  ad: string;
  soyad: string;
  telefon: string;
  not: string;
  ziyaretSayisi: number;
  toplamHarcama: number;
  /** Kalan veresiye borcu (tutar - odenen toplamı, asla negatif değil). */
  borc: number;
  sonZiyaret: string | null;
  sonHizmet: string | null;
  sonTutar: number | null;
  silindi: boolean;
  olusturmaZamani: string;
};

export type MusteriGirdi = {
  ad: string;
  soyad: string;
  telefon: string;
  not: string;
};

export type Ziyaret = {
  id: string;
  musteriId: string;
  hizmet: string;
  tutar: number;
  tarih: string;
  not: string;
  durum: ZiyaretDurum;
  /** Tahsil edilen kısım (0 = ödenmedi). Kalan = tutar - odenen. */
  odenen: number;
  olusturmaZamani: string;
};

export type ZiyaretGirdi = {
  musteriId: string;
  hizmet: string;
  tutar: number;
  tarih: string;
  not: string;
  odenen?: number;
};

/** Aktif iş: teslim edilmemiş ziyaret + müşteri kimliği. */
export type AktifZiyaret = Ziyaret & {
  ad: string;
  soyad: string;
  telefon: string;
};
