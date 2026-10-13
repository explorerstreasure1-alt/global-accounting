import { head, put } from "@vercel/blob";

/**
 * Vercel Blob tabanlı ayar deposu: WhatsApp gönderici no, otomatik mesaj
 * şablonları ve Google yorum linki Supabase şemasına hiç dokunmadan burada
 * saklanır. İşletme başına tek JSON dosyası (ayarlar/<businessId>.json).
 * BLOB_READ_WRITE_TOKEN yoksa sessizce devre dışı kalır (null/false döner).
 */

export type BlobAyar = {
  whatsappIsletme: string;
  waSablonAlindi: string;
  waSablonHazir: string;
  googleYorumLink: string;
};

export function blobAktif(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function yol(businessId: string): string {
  const temiz = String(businessId || "local").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 60) || "local";
  return `ayarlar/${temiz}.json`;
}

function temizle(v: unknown, enFazla: number): string {
  return String(v ?? "").trim().slice(0, enFazla);
}

export function blobNormalize(v: Partial<BlobAyar>): BlobAyar {
  return {
    whatsappIsletme: temizle(v.whatsappIsletme, 30),
    waSablonAlindi: String(v.waSablonAlindi ?? "").slice(0, 500),
    waSablonHazir: String(v.waSablonHazir ?? "").slice(0, 500),
    googleYorumLink: temizle(v.googleYorumLink, 300),
  };
}

export async function blobAyarOku(businessId: string): Promise<BlobAyar | null> {
  if (!blobAktif()) return null;
  try {
    const meta = await head(yol(businessId));
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<BlobAyar>;
    return blobNormalize(j);
  } catch {
    return null;
  }
}

export async function blobAyarYaz(businessId: string, v: Partial<BlobAyar>): Promise<boolean> {
  if (!blobAktif()) return false;
  try {
    await put(yol(businessId), JSON.stringify(blobNormalize(v)), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return true;
  } catch {
    return false;
  }
}
