import { NextResponse } from "next/server";
import type { Ayarlar } from "@/lib/types";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const ayarlar = await db.getAyarlar();
  return NextResponse.json({ ayarlar });
}

export async function PUT(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  try {
    const body = (await request.json()) as Partial<Ayarlar>;
    const ayarlar = await db.updateAyarlar(body);
    return NextResponse.json({ ayarlar });
  } catch (e) {
    // Teşhis için asıl sebep döndürülür (ekranda toast ile gösterilir).
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
