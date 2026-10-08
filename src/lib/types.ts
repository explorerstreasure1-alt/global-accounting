export const KATEGORILER = [
  "Kira",
  "Elektrik",
  "Su",
  "Doğalgaz",
  "Ev",
  "İş Yeri",
  "Hizmet",
  "Market",
  "Diğer",
] as const;

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
  /** Yapay zekâ motoru: otomatik (Groq beyin + Ollama anlatım), groq (her şey Groq), ollama (önce yerel) */
  aiMotor: "otomatik" | "groq" | "ollama";
  /** Ollama modeli (ör. gemma3:4b). Ollama kapalıysa Groq devreye girer. */
  ollamaModel: string;
  /** WhatsApp rapor alıcısı (örn. 0556102095). */
  whatsappAlici: string;
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
