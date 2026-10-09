import { NextResponse } from "next/server";
import { addMonths } from "@/lib/format";
import { round2 } from "@/lib/format";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// POST /api/kira-bol { ay }: son kira gider kaydını N aya böler (AI'sız)
export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  let ay = 6;
  try {
    const body = (await request.json()) as { ay?: unknown };
    if (typeof body.ay === "number" && body.ay >= 1 && body.ay <= 36) ay = Math.floor(body.ay);
  } catch { /* varsayılan */ }

  const kayitlar = await db.listKayitlar();
  const kiralar = kayitlar
    .filter((k) => k.kategori === "Rent" && k.gider > 0)
    .sort((a, b) => b.olusturmaZamani.localeCompare(a.olusturmaZamani));
  const hedef = kiralar[0];
  if (!hedef) return NextResponse.json({ error: "splittable-rent-not-found" }, { status: 404 });

  const parca = round2(hedef.gider / ay);
  await db.deleteKayit(hedef.id);
  for (let i = 0; i < ay; i += 1) {
    await db.createKayit({
      tarih: addMonths(hedef.tarih, i),
      aciklama: `${hedef.aciklama} (${i + 1}/${ay})`,
      kategori: "Rent",
      gelir: 0,
      gider: parca,
      odemeTipi: hedef.odemeTipi,
    });
  }
  const ayarlar = await db.updateAyarlar({
    kiraTutari: hedef.gider,
    kiraPeriyodu: ay,
    aylikKiraKarsiligi: parca,
  });
  const data = await db.getInitData();
  return NextResponse.json({ ok: true, ay, parca, ayarlar, data });
}
