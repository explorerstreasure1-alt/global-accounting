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
    // Teşhis: PostgREST schema cache bayatsa (PGRST204) sunucu yeni kolonları
    // sessizce eleyebilir; istenip de yazılamayanları cevapta bildir.
    const atlananKolonlar: string[] = [];
    if (body.whatsappIsletme !== undefined && String(body.whatsappIsletme).trim().slice(0, 30) !== ayarlar.whatsappIsletme) atlananKolonlar.push("whatsapp_isletme");
    if (body.googleYorumLink !== undefined && String(body.googleYorumLink).trim().slice(0, 300) !== ayarlar.googleYorumLink) atlananKolonlar.push("google_yorum_link");
    if (body.waSablonAlindi !== undefined && String(body.waSablonAlindi).slice(0, 500) !== ayarlar.waSablonAlindi) atlananKolonlar.push("wa_sablon_alindi");
    if (body.waSablonHazir !== undefined && String(body.waSablonHazir).slice(0, 500) !== ayarlar.waSablonHazir) atlananKolonlar.push("wa_sablon_hazir");
    return NextResponse.json({ ayarlar, atlananKolonlar });
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
