import { NextResponse } from "next/server";
import { KATEGORILER, KATEGORI_ESKI, type Kategori, type OdemeTipi } from "@/lib/types";
import { toISODate } from "@/lib/format";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const kayitlar = await db.listKayitlar();
  return NextResponse.json({ kayitlar });
}

export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const body = (await request.json()) as Record<string, unknown>;
  const kategoriRaw = String(body.kategori || "Other");
  const kategori = (KATEGORILER as readonly string[]).includes(kategoriRaw)
    ? (kategoriRaw as Kategori)
    : ((KATEGORI_ESKI[kategoriRaw] ?? "Other") as Kategori);
  const kayit = await db.createKayit({
    tarih: String(body.tarih || toISODate()),
    aciklama: String(body.aciklama || ""),
    kategori,
    gelir: Number(body.gelir || 0),
    gider: Number(body.gider || 0),
    odemeTipi: body.odemeTipi === "Kart" ? "Kart" : body.odemeTipi === "Havale" ? "Havale" : ("Nakit" as OdemeTipi),
  });
  return NextResponse.json({ kayit });
}
