import { NextResponse } from "next/server";
import { ulkeTespit } from "@/lib/ulke";
import { takipKaydet } from "@/lib/site-takip";

export const dynamic = "force-dynamic";

/**
 * Halka açık takip ucu: SiteTakip bileşeni sayfa açılışını, giriş ekranı
 * başarılı oturumu buraya fısıldar. Supabase/DOSYA moduna göre kayıt atar.
 * Hatalar bile 200 döner — takip hiçbir zaman kullanıcıyı bozmasın.
 */
export async function POST(request: Request) {
  let body: { olay?: string; kaynak?: string; email?: string; yol?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* gövdesiz de olur */
  }
  const olay = body.olay === "giris" ? "giris" : "ziyaret";
  const email =
    typeof body.email === "string" && body.email.includes("@")
      ? body.email.toLowerCase().slice(0, 200)
      : null;
  const kaynak = olay === "giris" ? (body.kaynak === "google" ? "google" : "parola") : "";
  const yol = String(body.yol || "/").slice(0, 200);
  const ulke = await ulkeTespit(request);
  try {
    await takipKaydet({ olay, kaynak, email, ulke, yol: olay === "ziyaret" ? yol : "/giris" });
  } catch (e) {
    console.error("[takip]", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
