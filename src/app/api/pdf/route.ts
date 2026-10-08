import { NextResponse } from "next/server";
import { getAyarlar, listKayitlar } from "@/lib/data";
import { buildRapor, monthRange } from "@/lib/reports";
import { toISODate } from "@/lib/format";
import { raporBasligi } from "@/lib/excel";
import { raporPdfUret } from "@/lib/rapor-pdf";

export const dynamic = "force-dynamic";

const DAMGA: Record<string, string> = {
  defter: "DEFTER",
  z: "Z RAPORU",
  gunsonu: "GÜN SONU",
  aysonu: "AY SONU",
  karzarar: "KAR-ZARAR",
  ozet: "ÖZET",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tip = url.searchParams.get("tip") || "z";
  const today = toISODate();
  const now = new Date();
  const month = monthRange(now.getFullYear(), now.getMonth() + 1);
  const baslangic = url.searchParams.get("baslangic") || (tip === "gunsonu" ? today : month.baslangic);
  const bitis = url.searchParams.get("bitis") || (tip === "gunsonu" ? today : month.bitis);

  const [kayitlar, ayarlar] = await Promise.all([listKayitlar(), getAyarlar()]);
  const rapor = buildRapor(kayitlar, ayarlar, baslangic, bitis);
  const pdf = await raporPdfUret(rapor, ayarlar, raporBasligi(tip), DAMGA[tip] ?? "RAPOR");
  const filename = `${raporBasligi(tip).replace(/ /g, "-")}-${baslangic}-${bitis}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
