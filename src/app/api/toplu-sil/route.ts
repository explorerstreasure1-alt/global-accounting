import { NextResponse } from "next/server";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// POST /api/toplu-sil { baslangic, bitis, kategori?, onayla? }
// onayla yoksa: önizleme (adet + ilk 5 örnek). onayla=true ise: siler.
export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  let baslangic = "";
  let bitis = "";
  let kategori: string | undefined;
  let onayla = false;
  try {
    const body = (await request.json()) as { baslangic?: unknown; bitis?: unknown; kategori?: unknown; onayla?: unknown };
    baslangic = typeof body.baslangic === "string" ? body.baslangic : "";
    bitis = typeof body.bitis === "string" ? body.bitis : "";
    kategori = typeof body.kategori === "string" && body.kategori ? body.kategori : undefined;
    onayla = body.onayla === true;
  } catch { /* boş */ }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baslangic) || !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) {
    return NextResponse.json({ error: "invalid-range" }, { status: 400 });
  }
  const kayitlar = await db.listKayitlar();
  const hedef = kayitlar.filter(
    (k) => k.tarih >= baslangic && k.tarih <= bitis && (!kategori || k.kategori === kategori),
  );
  if (!onayla) {
    return NextResponse.json({
      ok: true,
      preview: true,
      adet: hedef.length,
      ornek: hedef.slice(0, 5).map((k) => ({ id: k.id, tarih: k.tarih, aciklama: k.aciklama, tutar: k.gelir || k.gider })),
    });
  }
  for (const k of hedef) {
    await db.deleteKayit(k.id);
  }
  const data = await db.getInitData();
  return NextResponse.json({ ok: true, silinen: hedef.length, data });
}
