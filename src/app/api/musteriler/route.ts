import { NextResponse } from "next/server";
import { toISODate } from "@/lib/format";
import { maskMusteri, maskAd, maskSoyad, maskTelefon } from "@/lib/gizlilik";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Liste vitrini maskelidir (ad/telefon gizli, veri DB'de de maskeli). Diskte önbelleklenmez. */
const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Müşteri listesi (arama + silinmişler anahtarı). */
export async function GET(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const silinmis = searchParams.get("silinmis") === "1";
  const musteriler = (await db.listMusteriler(q, silinmis)).map(maskMusteri);
  return NextResponse.json({ musteriler }, { headers: NO_STORE });
}

/** Hızlı ekleme: eşleşen müşteriyi bul ya da aç, ziyareti işle (EGZEL ARYA QuickAdd). */
export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const body = (await request.json()) as Record<string, unknown>;
  const ad = String(body.ad || "").trim().slice(0, 60);
  const soyad = String(body.soyad || "").trim().slice(0, 60);
  const telefon = String(body.telefon || "").trim().slice(0, 30);
  const not = String(body.not || "").trim().slice(0, 500);
  const hizmet = String(body.hizmet || "").trim().slice(0, 80);
  const tutar = Math.max(0, Number(body.tutar) || 0);
  const tarihRaw = String(body.tarih || "");
  const tarih = /^\d{4}-\d{2}-\d{2}$/.test(tarihRaw) ? tarihRaw : toISODate();

  const tum = await db.listMusteriler(undefined, true);
  let musteri = body.musteriId ? tum.find((x) => x.id === String(body.musteriId) && !x.silindi) : undefined;
  if (!musteri && telefon) musteri = tum.find((x) => !x.silindi && x.telefon === telefon);
  if (!musteri && ad) {
    const a = ad.toLocaleLowerCase(), s = soyad.toLocaleLowerCase();
    musteri = tum.find((x) => !x.silindi && x.ad.toLocaleLowerCase() === a && x.soyad.toLocaleLowerCase() === s);
  }
  const eslesti = Boolean(musteri);
  if (!musteri) musteri = await db.createMusteri({ ad: maskAd(ad || "İsimsiz"), soyad: maskSoyad(soyad), telefon: maskTelefon(telefon), not });

  let ziyaret = null;
  if (hizmet || tutar > 0) {
    ziyaret = await db.addZiyaret({ musteriId: musteri.id, hizmet, tutar, tarih, not: "" });
  }
  const guncel = await db.getMusteri(musteri.id);
  return NextResponse.json({ musteri: guncel ?? musteri, ziyaret, eslesti }, { status: 201 });
}
