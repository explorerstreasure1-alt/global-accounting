import { NextResponse } from "next/server";
import { getAyarlar, listKayitlar } from "@/lib/data";
import { buildRapor, computeUyarilar, monthRange } from "@/lib/reports";
import { toISODate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tip = url.searchParams.get("tip") || "ozet";
  const today = toISODate();
  const now = new Date();
  const month = monthRange(now.getFullYear(), now.getMonth() + 1);
  let baslangic = url.searchParams.get("baslangic") || month.baslangic;
  let bitis = url.searchParams.get("bitis") || month.bitis;
  if (tip === "gunsonu" || tip === "gunluk") {
    baslangic = url.searchParams.get("baslangic") || today;
    bitis = url.searchParams.get("bitis") || baslangic;
  }
  const [kayitlar, ayarlar] = await Promise.all([listKayitlar(), getAyarlar()]);
  const rapor = buildRapor(kayitlar, ayarlar, baslangic, bitis);
  const uyarilar = computeUyarilar(kayitlar, ayarlar, today);
  return NextResponse.json({ tip, rapor, uyarilar, ayarlar });
}
