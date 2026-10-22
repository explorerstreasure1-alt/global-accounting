import { NextResponse } from "next/server";
import { z } from "zod";
import { KATEGORILER, KATEGORI_ESKI, type Kategori, type OdemeTipi } from "@/lib/types";
import { toISODate } from "@/lib/format";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const KayitSchema = z.object({
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  aciklama: z.string().max(500).optional(),
  kategori: z.string().max(50).optional(),
  gelir: z.number().min(0).max(1_000_000_000).optional(),
  gider: z.number().min(0).max(1_000_000_000).optional(),
  odemeTipi: z.enum(["Nakit", "Kart", "Havale"]).optional(),
});

export async function GET() {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const kayitlar = await db.listKayitlar();
  return NextResponse.json({ kayitlar });
}

export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = KayitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const kategoriRaw = String(b.kategori || "Other");
  const kategori = (KATEGORILER as readonly string[]).includes(kategoriRaw)
    ? (kategoriRaw as Kategori)
    : ((KATEGORI_ESKI[kategoriRaw] ?? "Other") as Kategori);
  const kayit = await db.createKayit({
    tarih: String(b.tarih || toISODate()),
    aciklama: String(b.aciklama || ""),
    kategori,
    gelir: Number(b.gelir || 0),
    gider: Number(b.gider || 0),
    odemeTipi: b.odemeTipi === "Kart" ? "Kart" : b.odemeTipi === "Havale" ? "Havale" : ("Nakit" as OdemeTipi),
  });
  return NextResponse.json({ kayit });
}
