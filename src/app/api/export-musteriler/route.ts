import { NextResponse } from "next/server";
import { buildMusteriExcel } from "@/lib/excel";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Müşteri listesi Excel indir (kart + harcama + veresiye borcu). */
export async function GET(request: Request) {
  const { db, gate, business } = await resolveDb();
  if (gate) return gate;
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "en";
  const currency = url.searchParams.get("currency") || "USD";
  const [musteriler, ayarlar] = await Promise.all([db.listMusteriler(), db.getAyarlar()]);
  const wb = buildMusteriExcel(musteriler, { locale, currency, isletmeAdi: business?.name ?? ayarlar.isletmeAdi });
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="musteriler.xlsx"`,
    },
  });
}
