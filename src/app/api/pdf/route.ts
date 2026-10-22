import { NextResponse } from "next/server";
import { buildRapor, monthRange } from "@/lib/reports";
import { toISODate } from "@/lib/format";
import { raporBasligi } from "@/lib/excel";
import { raporPdfUret } from "@/lib/rapor-pdf";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const DAMGA: Record<string, Record<string, string>> = {
  tr: { defter: "DEFTER", z: "Z RAPORU", gunsonu: "GÜN SONU", aysonu: "AY SONU", karzarar: "KAR-ZARAR", ozet: "ÖZET" },
  en: { defter: "LEDGER", z: "Z REPORT", gunsonu: "DAY CLOSE", aysonu: "MONTH CLOSE", karzarar: "P&L", ozet: "SUMMARY" },
  de: { defter: "BUCH", z: "Z-BERICHT", gunsonu: "TAG", aysonu: "MONAT", karzarar: "G&V", ozet: "ÜBERSICHT" },
  fr: { defter: "REGISTRE", z: "RAPPORT Z", gunsonu: "JOUR", aysonu: "MOIS", karzarar: "P&P", ozet: "RÉSUMÉ" },
  es: { defter: "LIBRO", z: "INFORME Z", gunsonu: "DÍA", aysonu: "MES", karzarar: "P&P", ozet: "RESUMEN" },
  ar: { defter: "الدفتر", z: "تقرير Z", gunsonu: "اليوم", aysonu: "الشهر", karzarar: "ربح", ozet: "ملخص" },
  ru: { defter: "КНИГА", z: "Z-ОТЧЁТ", gunsonu: "ДЕНЬ", aysonu: "МЕСЯЦ", karzarar: "П&У", ozet: "ИТОГ" },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tip = url.searchParams.get("tip") || "z";
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
  const damgaMap = DAMGA[locale] ?? DAMGA.en;
  const pdf = await raporPdfUret(rapor, ayarlar, raporBasligi(tip, locale), damgaMap[tip] ?? "REPORT", { locale, currency });
  const filename = `${raporBasligi(tip, locale).replace(/ /g, "-")}-${baslangic}-${bitis}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
