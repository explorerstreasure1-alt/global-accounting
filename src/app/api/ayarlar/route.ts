import { NextResponse } from "next/server";
import type { Ayarlar } from "@/lib/types";
import { resolveDb } from "@/lib/tenant";
import { hasDatabase, pool } from "@/db";

export const dynamic = "force-dynamic";

type YeniAlanlar = {
  whatsapp_isletme: string;
  wa_sablon_alindi: string;
  wa_sablon_hazir: string;
  google_yorum_link: string;
};

/**
 * Direkt Postgres köprüsü: PostgREST schema cache (PGRST204) takılı kalsa bile
 * ayarları okur/yazar. PostgREST'i tamamen baypas eder, o yüzden önbellekten
 * bağımsızdır. business_id her sorguda eklenir — kiracı izolasyonu korunur.
 * DATABASE_URL yoksa null/false döner, normal akış aynen devam eder.
 */
async function direktOku(businessId: string): Promise<YeniAlanlar | null> {
  if (!hasDatabase || !pool) return null;
  try {
    const r = await pool.query(
      `select whatsapp_isletme, wa_sablon_alindi, wa_sablon_hazir, google_yorum_link
       from ayarlar where business_id = $1 limit 1`,
      [businessId],
    );
    const row = r.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      whatsapp_isletme: String(row.whatsapp_isletme ?? ""),
      wa_sablon_alindi: String(row.wa_sablon_alindi ?? ""),
      wa_sablon_hazir: String(row.wa_sablon_hazir ?? ""),
      google_yorum_link: String(row.google_yorum_link ?? ""),
    };
  } catch {
    return null;
  }
}

async function direktYaz(businessId: string, v: YeniAlanlar): Promise<boolean> {
  if (!hasDatabase || !pool) return false;
  try {
    await pool.query(
      `update ayarlar set whatsapp_isletme = $2, wa_sablon_alindi = $3,
       wa_sablon_hazir = $4, google_yorum_link = $5 where business_id = $1`,
      [businessId, v.whatsapp_isletme, v.wa_sablon_alindi, v.wa_sablon_hazir, v.google_yorum_link],
    );
    return true;
  } catch {
    return false;
  }
}

function birlestir(a: Ayarlar, d: YeniAlanlar | null): Ayarlar {
  if (!d) return a;
  return {
    ...a,
    whatsappIsletme: d.whatsapp_isletme,
    waSablonAlindi: d.wa_sablon_alindi,
    waSablonHazir: d.wa_sablon_hazir,
    googleYorumLink: d.google_yorum_link,
  };
}

export async function GET() {
  const { db, gate, business } = await resolveDb();
  if (gate) return gate;
  const ayarlar = await db.getAyarlar();
  // Önbellek eskiyse select * yeni kolonları döndürmez; direkt oku ve üzerine yaz.
  if (business) {
    const d = await direktOku(business.id);
    return NextResponse.json({ ayarlar: birlestir(ayarlar, d) });
  }
  return NextResponse.json({ ayarlar });
}

export async function PUT(request: Request) {
  const { db, gate, business } = await resolveDb();
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
    // Köprü: bir şey atlandıysa direkt yazmayı dene (önbellekten bağımsız).
    if (atlananKolonlar.length > 0 && business) {
      const tam: YeniAlanlar = {
        whatsapp_isletme: body.whatsappIsletme !== undefined ? String(body.whatsappIsletme).trim().slice(0, 30) : ayarlar.whatsappIsletme,
        wa_sablon_alindi: body.waSablonAlindi !== undefined ? String(body.waSablonAlindi).slice(0, 500) : ayarlar.waSablonAlindi,
        wa_sablon_hazir: body.waSablonHazir !== undefined ? String(body.waSablonHazir).slice(0, 500) : ayarlar.waSablonHazir,
        google_yorum_link: body.googleYorumLink !== undefined ? String(body.googleYorumLink).trim().slice(0, 300) : ayarlar.googleYorumLink,
      };
      if (await direktYaz(business.id, tam)) {
        const d = await direktOku(business.id);
        return NextResponse.json({ ayarlar: birlestir(ayarlar, d), atlananKolonlar: [] });
      }
    }
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
