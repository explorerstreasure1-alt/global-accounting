import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminOturumGecerli } from "@/lib/admin-guv";
import { saasConfigured } from "@/lib/tenant";
import {
  takipHam,
  takipServisiAcik,
  takipTanisi,
  servisAnahtariSorunu,
  takipKolonDurumu,
  takipKirpildiMi,
  takipOkumaHatasi,
  guneBol,
  buAyKullanicilari,
  ulkeDagilimi,
  sonUlke,
  distinctEpostalar,
  gunEtiketi,
  gunSiniri,
  ayBasiEtiketi,
  gunDetay,
  bugunku,
  tekilKisi,
  sonOlaylar,
  kullaniciDetaylari,
  saatlikDagilim,
  sayfaDagilimi,
  tarayiciDagilimi,
  isletimDagilimi,
  cihazTuruDagilimi,
  kaynakDagilimi,
  kisiDevamliligi,
  canliOzet,
  haftaninGunleri,
  oturumSuresi,
  hemenCikmaOrani,
  yeniGeriDonenOrani,
  sayfaDonusumOrani,
  trafficSourceAnalizi,
  aylikKarsilastirma,
  haftalikCohort,
} from "@/lib/site-takip";

export const dynamic = "force-dynamic";
// 20.000 olaya kadar tarama yapılabiliyor; Vercel'de varsayılan 10 sn yetmeyebilir.
export const maxDuration = 60;

const KORUNAN = { "Cache-Control": "no-store" };

/** Yönetici verisi: çerez kontrolü → toplu istatistik + ham hareket akışı. */
export async function GET() {
  const store = await cookies();
  if (!adminOturumGecerli(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, hata: "Yetkisiz" }, { status: 401, headers: KORUNAN });
  }

  // 32 gün: "bu ay" takvim ayı en fazla 31 gün olabildiği için tamamı kapsanır.
  const olaylar = await takipHam(32);
  const okumaHatasi = takipOkumaHatasi();
  const buAy = ayBasiEtiketi(); // YYYY-MM-01
  const otuzGunBasi = gunSiniri(30);
  const buAyOlaylar = olaylar.filter((o) => gunEtiketi(o.olusturma) >= buAy);
  const son30 = olaylar.filter((o) => gunEtiketi(o.olusturma) >= otuzGunBasi);

  let ziyaretBuAy = 0;
  let girisBuAy = 0;
  let googleBuAy = 0;
  let parolaBuAy = 0;
  let kayitBuAy = 0;
  const kullanan = new Set<string>();
  for (const o of buAyOlaylar) {
    if (o.olay === "ziyaret") {
      ziyaretBuAy++;
      continue;
    }
    girisBuAy++;
    if (o.kaynak === "google") googleBuAy++;
    else if (o.kaynak === "parola") parolaBuAy++;
    else if (o.kaynak === "kayit") kayitBuAy++;
    if (o.email) kullanan.add(o.email.toLowerCase());
  }

  const bugun = bugunku(olaylar);
  const bugunEtiket = gunEtiketi(new Date().toISOString());
  const bugunOlaylar = olaylar.filter((o) => gunEtiketi(o.olusturma) === bugunEtiket);
  const bugunTekilZiyaretci = tekilKisi(bugunOlaylar, "ziyaret");
  const bugunGirisKisi = new Set(
    bugunOlaylar.filter((o) => o.olay === "giris" && o.email).map((o) => o.email!.toLowerCase()),
  ).size;

  const tekilZiyaretciBuAy = tekilKisi(buAyOlaylar, "ziyaret");
  const girisKisiBuAy = new Set(
    buAyOlaylar.filter((o) => o.olay === "giris" && o.email).map((o) => o.email!.toLowerCase()),
  ).size;
  const oran = (pay: number, payda: number) => (payda > 0 ? Math.round((pay / payda) * 1000) / 1000 : 0);

  const gunluk = guneBol(son30, 30);
  const gunDetayVeri = gunDetay(son30, 30);
  const bugunSatir = gunluk[gunluk.length - 1] ?? { gun: bugunEtiket, ziyaret: 0, giris: 0, google: 0, parola: 0, kullanan: 0 };
  const dunSatir = gunluk[gunluk.length - 2] ?? { ...bugunSatir, gun: "" };
  const sonYedi = gunluk.slice(-7);
  const oncekiYedi = gunluk.slice(-14, -7);
  const topla = (liste: typeof gunluk, alan: "ziyaret" | "giris") =>
    liste.reduce((t, g) => t + g[alan], 0);
  const toplamZiyaret30 = topla(gunluk, "ziyaret");
  const enYogun = gunluk.reduce((a, b) => (b.ziyaret > a.ziyaret ? b : a), gunluk[0] ?? bugunSatir);

  const uyarilar: string[] = [];
  if (okumaHatasi) {
    uyarilar.push(`Takip verisi okunamadı: ${okumaHatasi}. Aşağıdaki sayılar eksik olabilir.`);
  }
  if (takipServisiAcik()) {
    if (olaylar.length === 0 && !okumaHatasi) {
      uyarilar.push(
        (await takipTanisi()) ||
        "Henüz kayıt yok. Tablo hazır; yeni bir sekmede siteyi bir kez gezince sayaçlar dolmaya başlar.",
      );
    }
  } else if (saasConfigured()) {
    uyarilar.push(
      servisAnahtariSorunu() ||
      "SUPABASE_SERVICE_ROLE_KEY eksik — kayıtlar sunucunun geçici hafızasına gidiyor; bulut kalıcılığı için Vercel env'ine anahtarı ekle.",
    );
  } else {
    uyarilar.push("Yerel dosya modu: kayıtlar bu sunucunun diskine yazılıyor (bulut yedeği yok).");
  }
  if (takipKolonDurumu() === false) {
    uyarilar.push(
      "IP/cihaz kolonları yok — `alter table site_takip add column if not exists ip varchar(64) not null default '';` ve cihaz kolonunu Supabase'te çalıştır.",
    );
  }
  if (takipKirpildiMi()) {
    uyarilar.push(
      "Son 20.000 olay tarandı; daha eski kayıtlar özetlere dahil edilmedi. Bu ayın tamamı için olay hacmini azalt veya arşivle.",
    );
  }
  if (olaylar.length > 0 && son30.length === 0) {
    uyarilar.push("Son 30 günde hareket yok; yalnızca daha eski kayıtlar bulundu.");
  }

  return NextResponse.json(
    {
      ok: true,
      buAy,
      veriZamani: new Date().toISOString(),
      mod: takipServisiAcik() ? "supabase" : "dosya",
      // Bu ay
      ziyaretBuAy,
      girisBuAy,
      googleBuAy,
      parolaBuAy,
      kayitBuAy,
      kullananBuAy: kullanan.size,
      tekilZiyaretciBuAy,
      girisKisiBuAy,
      donusumBuAy: oran(girisKisiBuAy, tekilZiyaretciBuAy),
      // Bugün
      bugunZiyaret: bugun.ziyaret,
      bugunGiris: bugun.giris,
      bugunTekil: tekilKisi(bugunOlaylar),
      bugunTekilZiyaretci,
      bugunGirisKisi,
      bugunDonusum: oran(bugunGirisKisi, bugunTekilZiyaretci),
      // 30 gün
      ziyaretci30: tekilKisi(son30),
      girisKisi30: new Set(
        son30.filter((o) => o.olay === "giris" && o.email).map((o) => o.email!.toLowerCase()),
      ).size,
      gunluk,
      gunDetay: gunDetayVeri,
      kullanicilar: buAyKullanicilari(olaylar),
      kullaniciDetay: kullaniciDetaylari(son30),
      sonOlaylar: sonOlaylar(olaylar, 200),
      ulkeler: ulkeDagilimi(son30),
      sonUlke: sonUlke(olaylar),
      epostalar: distinctEpostalar(son30),
      // Kırılımlar
      saatlik: saatlikDagilim(olaylar, 24),
      sayfalar: sayfaDagilimi(son30, 12),
      tarayicilar: tarayiciDagilimi(son30),
      isletimler: isletimDagilimi(son30),
      cihazTurleri: cihazTuruDagilimi(son30),
      kaynaklar: kaynakDagilimi(son30),
      devamlilik: kisiDevamliligi(son30),
      canli: canliOzet(olaylar, 5),
      // Yeni gelişmiş metrikler
      haftaninGunleri: haftaninGunleri(son30),
      oturumSuresi: oturumSuresi(son30),
      hemenCikma: hemenCikmaOrani(son30),
      yeniGeriDonen: yeniGeriDonenOrani(son30),
      sayfaDonusum: sayfaDonusumOrani(son30, 10),
      trafficSource: trafficSourceAnalizi(son30),
      aylikKarsilastirma: aylikKarsilastirma(olaylar),
      cohort: haftalikCohort(son30, 8),
      trend: {
        bugunZiyaret: bugunSatir.ziyaret,
        bugunGiris: bugunSatir.giris,
        dunZiyaret: dunSatir.ziyaret,
        dunGiris: dunSatir.giris,
        yediZiyaret: topla(sonYedi, "ziyaret"),
        yediGiris: topla(sonYedi, "giris"),
        oncekiYediZiyaret: topla(oncekiYedi, "ziyaret"),
        oncekiYediGiris: topla(oncekiYedi, "giris"),
      },
      ozet: {
        aktifGun: gunluk.filter((g) => g.ziyaret > 0 || g.giris > 0).length,
        enYogunGun: enYogun.gun,
        enYogunZiyaret: enYogun.ziyaret,
        ortGunlukZiyaret: Math.round((toplamZiyaret30 / 30) * 10) / 10,
        sonOlayZamani: olaylar.length ? olaylar[olaylar.length - 1].olusturma : "",
        toplamZiyaret30,
      },
      // Teşhis
      ipKolonu: takipKolonDurumu() !== false,
      olaySayisi: olaylar.length,
      buAyOlaySayisi: buAyOlaylar.length,
      son30OlaySayisi: son30.length,
      kirpildi: takipKirpildiMi(),
      uyari: uyarilar.filter(Boolean).join(" · "),
      uyarilar: uyarilar.filter(Boolean),
      projeRef: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)\./)?.[1] ?? "",
    },
    { headers: KORUNAN },
  );
}
