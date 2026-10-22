/**
 * Site takibi: ziyaret + giriş olayları.
 * İki mod:
 *  - Supabase açık + SUPABASE_SERVICE_ROLE_KEY varsa → `site_takip` tablosu (service_role, RLS bypass)
 *  - Yoksa → yerel dosya `site-takip.jsonl` (getDataDir altında, satır satır JSON)
 *
 * Yönetici paneli (/admin) bu veriyi `/api/admin/veri` üzerinden topluca görür.
 */
import { promises as fs } from "fs";
import path from "path";
import { saasConfigured } from "./tenant";
import { getDataDir } from "./file-store";

export type TakipOlayi = {
  olusturma: string; // ISO
  olay: "ziyaret" | "giris";
  kaynak: string; // "" | "google" | "parola"
  email: string | null;
  ulke: string;
  yol: string;
};

/** Sadece sunucu: service-role anahtarı var mı? */
export function takipServisiAcik(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      saasConfigured(),
  );
}

async function supaVe() {
  const { createServiceClient } = await import("./supabase/server");
  return createServiceClient();
}

/** Olay kaydet (sunucu tarafı). Hint verirse hata at, sessiz kalmayı çağıran seçer. */
export async function takipKaydet(olay: Omit<TakipOlayi, "olusturma">): Promise<void> {
  const satir: TakipOlayi = { olusturma: new Date().toISOString(), ...olay };
  if (takipServisiAcik()) {
    const supa = await supaVe();
    const { error } = await supa.from("site_takip").insert({
      olay: satir.olay,
      kaynak: satir.kaynak,
      email: satir.email,
      ulke: satir.ulke,
      yol: (satir.yol || "").slice(0, 200),
    });
    if (error) throw new Error(error.message);
    return;
  }
  const dosya = path.join(getDataDir(), "site-takip.jsonl");
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  await fs.appendFile(dosya, JSON.stringify(satir) + "\n", "utf8");
}

/** Ham olaylar (son N gün). Yerel modda tam dosya okunup süzülür. */
export async function takipHam(gun: number): Promise<TakipOlayi[]> {
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000).toISOString();
  if (takipServisiAcik()) {
    const supa = await supaVe();
    const { data, error } = await supa
      .from("site_takip")
      .select("olusturma, olay, kaynak, email, ulke, yol")
      .order("olusturma", { ascending: false })
      .limit(gun * 2000);
    if (error) return [];
    return (data ?? [])
      .map((r) => ({
        olusturma: String(r.olusturma),
        olay: r.olay as TakipOlayi["olay"],
        kaynak: String(r.kaynak ?? ""),
        email: (r.email as string | null) ?? null,
        ulke: String(r.ulke ?? ""),
        yol: String(r.yol ?? ""),
      }))
      .filter((r) => r.olusturma >= sinir);
  }
  try {
    const dosya = path.join(getDataDir(), "site-takip.jsonl");
    const icerik = await fs.readFile(dosya, "utf8");
    const satirlar = icerik.trim().split("\n").filter(Boolean);
    const liste: TakipOlayi[] = [];
    for (const s of satirlar) {
      try {
        const j = JSON.parse(s) as TakipOlayi;
        if (j.olusturma >= sinir) liste.push(j);
      } catch {
        /* bozuk satırı yoksay */
      }
    }
    return liste;
  } catch {
    return [];
  }
}

/** Gün etiketi (Europe/Istanbul): "2026-10-22" */
export function gunEtiketi(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(iso));
}

export type GunSatiri = {
  gun: string;
  ziyaret: number;
  giris: number;
  google: number;
  parola: number;
  kullanan: number; // farklı e-posta
};

export function guneBol(olaylar: TakipOlayi[], gunSayisi: number): GunSatiri[] {
  const bugun = gunEtiketi(new Date().toISOString());
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const gunler: string[] = [];
  for (let i = gunSayisi - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    gunler.push(fmt.format(d));
  }
  const harita = new Map<string, { ziyaret: number; giris: number; google: number; parola: number; mail: Set<string> }>();
  for (const g of gunler) harita.set(g, { ziyaret: 0, giris: 0, google: 0, parola: 0, mail: new Set() });
  for (const o of olaylar) {
    const g = gunEtiketi(o.olusturma);
    const k = harita.get(g);
    if (!k) continue;
    if (o.olay === "ziyaret") k.ziyaret++;
    else {
      k.giris++;
      if (o.kaynak === "google") k.google++;
      else if (o.kaynak === "parola") k.parola++;
      if (o.email) k.mail.add(o.email.toLowerCase());
    }
  }
  return gunler.map((gun) => {
    const k = harita.get(gun)!;
    return { gun, ziyaret: k.ziyaret, giris: k.giris, google: k.google, parola: k.parola, kullanan: k.mail.size };
  });
}

export type KullaniciSatiri = {
  email: string;
  adet: number; // bu ay kaç kez giriş
  sonGiris: string;
  ulke: string;
  kaynak: string;
};

/** Bu ayın kullanıcı tablosu: kim kaç kez girmiş, hangi ülkeden, en son ne zaman */
export function buAyKullanicilari(olaylar: TakipOlayi[]): KullaniciSatiri[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const buAy = fmt.format(new Date()).slice(0, 7); // YYYY-MM
  const harita = new Map<string, KullaniciSatiri>();
  for (const o of olaylar) {
    if (o.olay !== "giris" || !o.email) continue;
    if (!gunEtiketi(o.olusturma).startsWith(buAy)) continue;
    const anahtar = o.email.toLowerCase();
    const mevcut = harita.get(anahtar);
    if (mevcut) {
      mevcut.adet++;
      if (o.olusturma > mevcut.sonGiris) {
        mevcut.sonGiris = o.olusturma;
        if (o.ulke) mevcut.ulke = o.ulke;
      }
    } else {
      harita.set(anahtar, {
        email: anahtar,
        adet: 1,
        sonGiris: o.olusturma,
        ulke: o.ulke || "",
        kaynak: o.kaynak === "google" ? "google" : o.kaynak === "parola" ? "parola" : "",
      });
    }
  }
  return [...harita.values()].sort((a, b) => b.adet - a.adet || (a.sonGiris < b.sonGiris ? 1 : -1));
}

export type UlkeSatiri = { ulke: string; adet: number };

export function ulkeDagilimi(olaylar: TakipOlayi[]): UlkeSatiri[] {
  const harita = new Map<string, number>();
  for (const o of olaylar) {
    if (!o.ulke) continue;
    harita.set(o.ulke, (harita.get(o.ulke) || 0) + 1);
  }
  return [...harita.entries()]
    .map(([ulke, adet]) => ({ ulke, adet }))
    .sort((a, b) => b.adet - a.adet)
    .slice(0, 10);
}

export function sonUlke(olaylar: TakipOlayi[]): { ulke: string; zaman: string } {
  for (const o of olaylar) {
    if (o.ulke) return { ulke: o.ulke, zaman: o.olusturma };
  }
  return { ulke: "", zaman: "" };
}

export function distinctEpostalar(olaylar: TakipOlayi[]): { email: string; sonZaman: string; adet: number }[] {
  const harita = new Map<string, { email: string; sonZaman: string; adet: number }>();
  for (const o of olaylar) {
    if (!o.email) continue;
    const a = o.email.toLowerCase();
    const mevcut = harita.get(a);
    if (mevcut) {
      mevcut.adet++;
      if (o.olusturma > mevcut.sonZaman) mevcut.sonZaman = o.olusturma;
    } else {
      harita.set(a, { email: a, sonZaman: o.olusturma, adet: 1 });
    }
  }
  return [...harita.values()].sort((a, b) => (a.sonZaman < b.sonZaman ? 1 : -1));
}
