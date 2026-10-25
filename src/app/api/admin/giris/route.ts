import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  adminSifreTanimsiz,
  girisBasarili,
  girisBasarisiz,
  girisIzni,
  oturumToken,
  sifreDogru,
} from "@/lib/admin-guv";
import { ipTespit } from "@/lib/ulke";

export const dynamic = "force-dynamic";

const KORUNAN = { "Cache-Control": "no-store" };

/** Şifre doğrula + başarılıysa httpOnly admin çerezi kur. */
export async function POST(request: Request) {
  // Üretimde ADMIN_PASSWORD tanımlı değilse varsayılan şifreyle giriş YOK.
  if (adminSifreTanimsiz()) {
    return NextResponse.json(
      { ok: false, hata: "ADMIN_PASSWORD tanımlı değil. Vercel ortam değişkenlerine ekleyip yeniden deploy et." },
      { status: 500, headers: KORUNAN },
    );
  }

  const ip = ipTespit(request) || "bilinmeyen";
  const izin = girisIzni(ip);
  if (!izin.izin) {
    return NextResponse.json(
      {
        ok: false,
        hata: `Çok fazla hatalı deneme. ${izin.kalanSaniye} saniye sonra tekrar dene.`,
        kalanSaniye: izin.kalanSaniye,
      },
      { status: 429, headers: { ...KORUNAN, "Retry-After": String(izin.kalanSaniye) } },
    );
  }

  let body: { sifre?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const tamam = sifreDogru(typeof body.sifre === "string" ? body.sifre : "");
  if (!tamam) {
    // Kaba kuvvet denemelerini yavaşlat + IP başına deneme sınırı koy.
    await new Promise((r) => setTimeout(r, 600));
    const sonra = girisBasarisiz(ip);
    return NextResponse.json(
      {
        ok: false,
        hata: sonra.izin
          ? "Şifre yanlış."
          : `Çok fazla hatalı deneme. ${sonra.kalanSaniye} saniye sonra tekrar dene.`,
        kalanDeneme: sonra.kalanDeneme,
        kalanSaniye: sonra.kalanSaniye,
      },
      { status: 401, headers: KORUNAN },
    );
  }

  girisBasarili(ip);
  const store = await cookies();
  store.set(ADMIN_COOKIE, oturumToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 saat
  });
  return NextResponse.json({ ok: true }, { headers: KORUNAN });
}

/** Çıkış: admin çerezini sunucuda da sil. */
export async function DELETE() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true }, { headers: KORUNAN });
}
