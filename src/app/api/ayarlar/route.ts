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
    // Supabase hataları nesnedir; message/details/hint alanları metne çevrilir.
    const err = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown } | null;
    const parcalar: string[] = [];
    if (err && typeof err.message === "string" && err.message) parcalar.push(err.message);
    if (err && typeof err.details === "string" && err.details) parcalar.push(err.details);
    if (err && typeof err.hint === "string" && err.hint) parcalar.push(err.hint);
    if (err && typeof err.code === "string" && err.code) parcalar.push(`(kod:${err.code})`);
    let metin = parcalar.join(" ");
    if (!metin) {
      try {
        metin = JSON.stringify(e) ?? String(e);
      } catch {
        metin = String(e);
      }
    }
    return NextResponse.json({ error: metin.slice(0, 300) }, { status: 500 });
  }
}
