import { NextResponse } from "next/server";
import { getAyarlar, listKayitlar } from "@/lib/data";
import { buildRapor, monthRange } from "@/lib/reports";
import { toISODate } from "@/lib/format";
import { buildExcel, raporBasligi } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tip = url.searchParams.get("tip") || "defter";
  const today = toISODate();
  const now = new Date();
  const month = monthRange(now.getFullYear(), now.getMonth() + 1);
  const baslangic = url.searchParams.get("baslangic") || (tip === "gunsonu" ? today : month.baslangic);
  const bitis = url.searchParams.get("bitis") || (tip === "gunsonu" ? today : month.bitis);

  const [kayitlar, ayarlar] = await Promise.all([listKayitlar(), getAyarlar()]);
  const rapor = buildRapor(kayitlar, ayarlar, baslangic, bitis);
  const wb = buildExcel(tip, ayarlar, rapor);
  const buf = await wb.xlsx.writeBuffer();
  const filename = `${raporBasligi(tip).replace(/ /g, "-")}-${baslangic}-${bitis}.xlsx`;
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
