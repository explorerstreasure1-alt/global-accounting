import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, oturumToken, sifreDogru } from "@/lib/admin-guv";

export const dynamic = "force-dynamic";

/** Şifre doğrula + başarılıysa httpOnly admin çerezi kur. */
export async function POST(request: Request) {
  let body: { sifre?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const tamam = sifreDogru(typeof body.sifre === "string" ? body.sifre : "");
  if (!tamam) {
    // Kaba kuvvet denemelerini yavaşlat
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, hata: "Şifre yanlış." }, { status: 401 });
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, oturumToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 saat
  });
  return NextResponse.json({ ok: true });
}
