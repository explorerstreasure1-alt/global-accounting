import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminOturumGecerli } from "@/lib/admin-guv";
import { saasConfigured } from "@/lib/tenant";
import {
  takipHam,
  takipServisiAcik,
  takipTanisi,
  servisAnahtariSorunu,
  guneBol,
  buAyKullanicilari,
  ulkeDagilimi,
  sonUlke,
  distinctEpostalar,
  gunEtiketi,
  gunDetay,
  bugunku,
} from "@/lib/site-takip";

export const dynamic = "force-dynamic";

const KORUNAN = { "Cache-Control": "no-store" };

/** Yönetici verisi: çerez kontrolü → toplu istatistik. */
export async function GET() {
  const store = await cookies();
  if (!adminOturumGecerli(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, hata: "Yetkisiz" }, { status: 401, headers: KORUNAN });
  }

  const olaylar = await takipHam(30);
  const ayOncEv = gunEtiketi(new Date().toISOString()).slice(0, 7); // YYYY-MM
  const buAyOlaylar = olaylar.filter((o) => gunEtiketi(o.olusturma).startsWith(ayOncEv));

  let ziyaretBuAy = 0;
  let girisBuAy = 0;
  let googleBuAy = 0;
  const kullanan = new Set<string>();
  for (const o of buAyOlaylar) {
    if (o.olay === "ziyaret") ziyaretBuAy++;
    else {
      girisBuAy++;
      if (o.kaynak === "google") googleBuAy++;
      if (o.email) kullanan.add(o.email.toLowerCase());
    }
  }

  const uyari = takipServisiAcik()
    ? olaylar.length === 0
      ? (await takipTanisi()) ||
        "Henüz kayıt yok. Tablo hazır; yeni bir sekmede siteyi bir kez gezince sayaçlar dolmaya başlar."
      : ""
    : saasConfigured()
      ? servisAnahtariSorunu() ||
        "SUPABASE_SERVICE_ROLE_KEY eksik — kayıtlar sunucunun geçici hafızasına gidiyor; bulut kalıcılığı için Vercel env'ine anahtarı ekle."
      : "";

  const bugun = bugunku(olaylar);

  return NextResponse.json(
    {
      ok: true,
      buAy: ayOncEv,
      ziyaretBuAy,
      girisBuAy,
      googleBuAy,
      parolaBuAy: girisBuAy - googleBuAy,
      kullananBuAy: kullanan.size,
      bugunZiyaret: bugun.ziyaret,
      bugunGiris: bugun.giris,
      gunluk: guneBol(olaylar, 30),
      gunDetay: gunDetay(olaylar, 30),
      kullanicilar: buAyKullanicilari(olaylar),
      ulkeler: ulkeDagilimi(olaylar),
      sonUlke: sonUlke(olaylar),
      epostalar: distinctEpostalar(olaylar),
      uyari,
      projeRef: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)\./)?.[1] ?? "",
    },
    { headers: KORUNAN },
  );
}
