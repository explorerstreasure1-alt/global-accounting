import { NextResponse } from "next/server";
import { createKayit, listKayitlar } from "@/lib/data";
import { KATEGORILER, type Kategori, type OdemeTipi } from "@/lib/types";
import { toISODate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const kayitlar = await listKayitlar();
  return NextResponse.json({ kayitlar });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const kategoriRaw = String(body.kategori || "Diğer");
  const kategori = (KATEGORILER as readonly string[]).includes(kategoriRaw)
    ? (kategoriRaw as Kategori)
    : "Diğer";
  const kayit = await createKayit({
    tarih: String(body.tarih || toISODate()),
    aciklama: String(body.aciklama || ""),
    kategori,
    gelir: Number(body.gelir || 0),
    gider: Number(body.gider || 0),
    odemeTipi: body.odemeTipi === "Kart" ? "Kart" : body.odemeTipi === "Havale" ? "Havale" : ("Nakit" as OdemeTipi),
  });
  return NextResponse.json({ kayit });
}
