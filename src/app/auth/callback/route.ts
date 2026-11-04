import { NextResponse, after, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ulkeTespit, ipTespit, cihazTespit } from "@/lib/ulke";
import { takipKaydet } from "@/lib/site-takip";

// Supabase OAuth dönüşü: code → session (Google ile giriş için şart)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Google "İptal" derse Supabase buraya error=access_denied ile döner.
  const oauthHatasi = url.searchParams.get("error");
  const hamNext = url.searchParams.get("next") ?? "/app";
  // Açık yönlendirme kilidi: yalnızca site içi yollar kabul edilir.
  const next = hamNext.startsWith("/") && !hamNext.startsWith("//") ? hamNext : "/app";

  /** Yönlendirme yanıtı: tarayıcı önbelleğe almasın (eski oturum durumu yapışmasın). */
  const yonlendir = (hedef: URL) => {
    const r = NextResponse.redirect(hedef);
    r.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return r;
  };

  // FIX #A: Hata durumunda sessizce /app'e yönlendirmek yerine giriş sayfasına
  // ?oauth=hata ile dön; orada kullanıcıya mesaj gösterilir. Hedef sayfa
  // (next) korunur ki tekrar denemede doğru yere gitsin.
  // loop=1: proxy'nin "girişli kullanıcıyı /app'e at" kuralını bu istekte kapatır
  // (yarım kalmış eski çerez yüzünden sonsuz yönlendirme döngüsü olmasın).
  const girisHatasi = () => {
    const hedef = new URL("/giris", url.origin);
    hedef.searchParams.set("oauth", "hata");
    hedef.searchParams.set("loop", "1");
    if (next !== "/app") hedef.searchParams.set("next", next);
    return yonlendir(hedef);
  };

  // FIX #A: kod yoksa (kullanıcı izin vermedi / bağlantı bozuk) exchange denenmez.
  if (oauthHatasi || !code) return girisHatasi();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return girisHatasi();
  }

  // FIX (döngü): Oturum çerezleri DOĞRUDAN yönlendirme yanıtına yazılır.
  // Önceden cookies() deposuna yazılıyordu; bazı sürümlerde bu çerezler
  // NextResponse.redirect yanıtına eklenmiyor, /app oturumu göremeyip /giris'e
  // geri atıyor ve Google girişi sonsuz döngüye giriyordu.
  const yanit = yonlendir(new URL(next, url.origin));
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => yanit.cookies.set(name, value, options));
        },
      },
    },
  );

  const { error } = await supa.auth.exchangeCodeForSession(code);

  // FIX #A: kod değişimi başarısızsa oturum açılmadı → hata ile girişe dön.
  if (error) return girisHatasi();

  // Giriş kaydı: e-posta + ülke + IP + cihaz → yönetici paneline akar.
  // FIX: Bu iş YANIT GÖNDERİLDİKTEN sonra yapılır. Önceden ülke tespiti (2,5 sn
  // x 2) + DB yazımı kullanıcıyı bekletiyordu; DB erişilemezse yönlendirme hiç
  // gerçekleşmiyordu ("sayfa gelmiyor").
  try {
    const { data: { user } } = await supa.auth.getUser();
    if (user?.email) {
      const eposta = user.email.toLowerCase();
      const saglayici = String(
        (user.app_metadata as { provider?: string } | undefined)?.provider || "",
      );
      const ip = ipTespit(request);
      const cihaz = cihazTespit(request);
      after(async () => {
        try {
          const ulke = await ulkeTespit(request);
          await takipKaydet({
            olay: "giris",
            kaynak: saglayici === "google" ? "google" : "parola",
            email: eposta,
            ulke,
            ip,
            cihaz,
            yol: "/app",
          });
        } catch {
          /* takip hatası girişe engel olmasın */
        }
      });
    }
  } catch {
    /* takip hatası girişe engel olmasın */
  }

  return yanit;
}
