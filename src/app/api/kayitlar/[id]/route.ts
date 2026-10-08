import { NextResponse } from "next/server";
import { deleteKayit, updateKayit } from "@/lib/data";
import { KATEGORILER, type Kategori, type KayitGirdi } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const patch: Partial<KayitGirdi> = {};
  if (typeof body.tarih === "string") patch.tarih = body.tarih;
  if (typeof body.aciklama === "string") patch.aciklama = body.aciklama;
  if (typeof body.kategori === "string" && (KATEGORILER as readonly string[]).includes(body.kategori)) {
    patch.kategori = body.kategori as Kategori;
  }
  if (body.gelir != null) patch.gelir = Number(body.gelir);
  if (body.gider != null) patch.gider = Number(body.gider);
  if (body.odemeTipi === "Kart" || body.odemeTipi === "Nakit" || body.odemeTipi === "Havale") patch.odemeTipi = body.odemeTipi;
  const kayit = await updateKayit(id, patch);
  if (!kayit) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  return NextResponse.json({ kayit });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteKayit(id);
  if (!ok) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
