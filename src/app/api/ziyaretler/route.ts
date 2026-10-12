import { NextResponse } from "next/server";
import type { ZiyaretDurum } from "@/lib/types";
import { toISODate } from "@/lib/format";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Aktif işler: teslim edilmemiş ziyaretler + müşteri kimliği. */
export async function GET() {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const aktif = await db.listAktifZiyaretler();
  return NextResponse.json({ aktif });
}

/** Yeni ziyaret/sipariş satırı. */
export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const body = (await request.json()) as Record<string, unknown>;
  const musteriId = String(body.musteriId || "");
  if (!musteriId) return NextResponse.json({ error: "musteri-gerekli" }, { status: 400 });
  const musteri = await db.getMusteri(musteriId);
  if (!musteri) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const tarihRaw = String(body.tarih || "");
  const ziyaret = await db.addZiyaret({
    musteriId,
    hizmet: String(body.hizmet || ""),
    tutar: Number(body.tutar || 0),
    tarih: /^\d{4}-\d{2}-\d{2}$/.test(tarihRaw) ? tarihRaw : toISODate(),
    not: String(body.not || ""),
  });
  return NextResponse.json({ ziyaret }, { status: 201 });
}

/** Durum ilerlet: hazirlaniyor → hazir → teslim. */
export async function PATCH(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const body = (await request.json()) as Record<string, unknown>;
  const id = String(body.id || "");
  const durum = String(body.durum || "") as ZiyaretDurum;
  if (!id) return NextResponse.json({ error: "id-gerekli" }, { status: 400 });
  const ziyaret = await db.updateZiyaretDurum(id, durum);
  if (!ziyaret) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ ziyaret });
}

/** Ziyaret satırını kalıcı sil (?id=). */
export async function DELETE(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id-gerekli" }, { status: 400 });
  const ok = await db.deleteZiyaret(id);
  if (!ok) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
