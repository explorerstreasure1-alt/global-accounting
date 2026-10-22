import { NextResponse } from "next/server";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Kart detayı bilinçli tekil erişimdir: tam veri verir, diskte önbelleklenmez. */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const { id } = await params;
  const musteri = await db.getMusteri(id);
  if (!musteri) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ musteri }, { headers: NO_STORE });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  if (body.restore === true) {
    const ok = await db.restoreMusteri(id);
    if (!ok) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return NextResponse.json({ musteri: await db.getMusteri(id) });
  }
  const musteri = await db.updateMusteri(id, {
    ad: body.ad !== undefined ? String(body.ad) : undefined,
    soyad: body.soyad !== undefined ? String(body.soyad) : undefined,
    telefon: body.telefon !== undefined ? String(body.telefon) : undefined,
    not: body.not !== undefined ? String(body.not) : undefined,
  });
  if (!musteri) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ musteri });
}

/** Yumuşak silme (geri alınabilir). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const { id } = await params;
  const ok = await db.deleteMusteri(id);
  if (!ok) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
