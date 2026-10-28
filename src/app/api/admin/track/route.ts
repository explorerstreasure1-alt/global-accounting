import { NextResponse } from "next/server";
import { ulkeTespit, ipTespit, cihazTespit } from "@/lib/ulke";
import { takipKaydet } from "@/lib/site-takip";
import { tokenSahibi, type Kimlik } from "@/lib/kimlik";
import { createClient as sunucuIstemci } from "@/lib/supabase/server";

/**
 * Sunucudaki Supabase oturum çerezinden kimlik çöz.
 * Tarayıcı `getSession()` ile token gönderemese bile (çerez bölünmesi,
 * yenileme yarışı, eski istemci sürümü) e-posta buradan güvenle okunur:
 * çerez httpOnly değil ama yine de sunucu tarafında doğrulanır.
 */
async function cerezKimligi(): Promise<Kimlik | null> {
  try {
    const supa = await sunucuIstemci();
    const { data } = await supa.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    // Doğrulama + 2 dk önbellek tokenSahibi içinde.
    return await tokenSahibi(token);
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

/**
 * Basit hız sınırı: aynı IP'den dakikada en fazla 120 olay.
 * Sunucusuz ortamda örnek başına çalışır; yine de kazara/otomatik
 * spam'in veritabanını doldurmasını engeller.
 */
const PENCERE_MS = 60_000;
const PENCERE_AZAMI = 120;
const pencereler = new Map<string, { adet: number; baslangic: number }>();

function hizSiniri(anahtar: string): boolean {
  const simdi = Date.now();
  const k = pencereler.get(anahtar);
  if (!k || simdi - k.baslangic > PENCERE_MS) {
    if (pencereler.size > 5000) pencereler.clear();
    pencereler.set(anahtar, { adet: 1, baslangic: simdi });
    return true;
  }
  k.adet++;
  return k.adet <= PENCERE_AZAMI;
}

/**
 * Halka açık takip ucu: SiteTakip bileşeni sayfa açılışını, giriş ekranı
 * başarılı oturumu buraya fısıldar. Supabase/DOSYA moduna göre kayıt atar.
 *
 * GÜVEN: e-posta artık gövdeden KABUL EDİLMEZ. İstemci Supabase erişim
 * jetonunu yollar, sunucu doğrular. Böylece "kim giriş yaptı" bilgisi
 * gerçeği yansıtır; sahte e-posta ile istatistik şişirilemez.
 *
 * Hatalar bile 200 döner — takip hiçbir zaman kullanıcıyı bozmasın.
 */
export async function POST(request: Request) {
  const ip = ipTespit(request);
  if (!hizSiniri(ip || "bilinmeyen")) {
    return NextResponse.json({ ok: true, atlandi: true });
  }

  let body: { olay?: string; kaynak?: string; token?: string; yol?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* gövdesiz de olur */
  }
  const olay = body.olay === "giris" ? "giris" : "ziyaret";

  // Kimlik: önce gövdedeki imzalı jeton, olmazsa sunucudaki oturum çerezi.
  const kimlik =
    (await tokenSahibi(typeof body.token === "string" ? body.token : null)) ??
    (await cerezKimligi());
  const email = kimlik?.email ?? null;

  // Doğrulanmamış giriş bildirimi kaydedilmez: sayaçlar yalnızca gerçek
  // oturumları saysın (aksi halde herkes elle "giriş" yazıp sayıyı şişirir).
  if (olay === "giris" && !kimlik) {
    return NextResponse.json({ ok: true, atlandi: true });
  }

  // Kaynak yalnızca doğrulanmış kimlikten gelir; yeni hesap "kayit" olarak işaretlenir.
  const kaynak = olay === "giris" && kimlik
    ? body.kaynak === "kayit" && kimlik.yeni
      ? "kayit"
      : kimlik.kaynak
    : "";

  const yol = String(body.yol || "/").slice(0, 200);
  const ulke = await ulkeTespit(request);
  const cihaz = cihazTespit(request);
  try {
    await takipKaydet({ olay, kaynak, email, ulke, ip, cihaz, yol: olay === "ziyaret" ? yol : "/giris" });
  } catch (e) {
    console.error("[takip]", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
