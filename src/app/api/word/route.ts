import { NextResponse } from "next/server";
import { buildRapor, monthRange } from "@/lib/reports";
import { toISODate } from "@/lib/format";
import { buildWord, wordBasligi } from "@/lib/word";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const url = new URL(request.url);
  const tip = url.searchParams.get("tip") || "z";
  const today = toISODate();
  const now = new Date();
  const month = monthRange(now.getFullYear(), now.getMonth() + 1);
  const baslangic = url.searchParams.get("baslangic") || (tip === "gunsonu" ? today : month.baslangic);
  const bitis = url.searchParams.get("bitis") || (tip === "gunsonu" ? today : month.bitis);
  const locale = url.searchParams.get("locale") || "en";
  const currency = url.searchParams.get("currency") || "USD";

  const [kayitlar, ayarlar] = await Promise.all([db.listKayitlar(), db.getAyarlar()]);
  const rapor = buildRapor(kayitlar, ayarlar, baslangic, bitis);
  const buf = await buildWord(tip, ayarlar, rapor, { locale, currency });
  const filename = `${wordBasligi(tip, locale).replace(/ /g, "-")}-${baslangic}-${bitis}.docx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
