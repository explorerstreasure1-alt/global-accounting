import { NextResponse } from "next/server";
import { buildRapor, monthRange } from "@/lib/reports";
import { toISODate } from "@/lib/format";
import { buildExcel, raporBasligi } from "@/lib/excel";
import { resolveDb } from "@/lib/tenant";
import { icerikYerlesimi } from "@/lib/dosya-adi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tip = url.searchParams.get("tip") || "defter";
    const today = toISODate();
    const now = new Date();
    const month = monthRange(now.getFullYear(), now.getMonth() + 1);
    const baslangic = url.searchParams.get("baslangic") || (tip === "gunsonu" ? today : month.baslangic);
    const bitis = url.searchParams.get("bitis") || (tip === "gunsonu" ? today : month.bitis);
    const locale = url.searchParams.get("locale") || "en";
    const currency = url.searchParams.get("currency") || "USD";

    const { db, gate } = await resolveDb();
    if (gate) return gate;
    const [kayitlar, ayarlar] = await Promise.all([db.listKayitlar(), db.getAyarlar()]);
    const rapor = buildRapor(kayitlar, ayarlar, baslangic, bitis);
    const wb = buildExcel(tip, ayarlar, rapor, { locale, currency });
    const buf = await wb.xlsx.writeBuffer();
    const filename = `${raporBasligi(tip, locale).replace(/ /g, "-")}-${baslangic}-${bitis}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": icerikYerlesimi(filename),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Excel oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
