import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminOturumGecerli } from "@/lib/admin-guv";
import { takipTest } from "@/lib/site-takip";

export const dynamic = "force-dynamic";

/** Yönetici: takip kaydının gerçekten yazılabildiğini dener, hatayı aynen döndürür. */
export async function POST() {
  const store = await cookies();
  if (!adminOturumGecerli(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, hata: "Yetkisiz" }, { status: 401 });
  }
  const sonuc = await takipTest();
  return NextResponse.json(sonuc, { headers: { "Cache-Control": "no-store" } });
}
