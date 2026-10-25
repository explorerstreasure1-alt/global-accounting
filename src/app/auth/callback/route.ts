import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ulkeTespit, ipTespit, cihazTespit } from "@/lib/ulke";
import { takipKaydet } from "@/lib/site-takip";

// Supabase OAuth dönüşü: code → session (Google ile giriş için şart)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const hamNext = url.searchParams.get("next") ?? "/app";
  // Açık yönlendirme kilidi: yalnızca site içi yollar kabul edilir.
  const next = hamNext.startsWith("/") && !hamNext.startsWith("//") ? hamNext : "/app";

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const store = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => store.getAll(),
          setAll: (list) => {
            try {
              list.forEach(({ name, value, options }) => store.set(name, value, options));
            } catch { /* ignore */ }
          },
        },
      },
    );
    const { error } = await supa.auth.exchangeCodeForSession(code);
    // Giriş kaydı: e-posta + ülke + IP + cihaz → yönetici paneline akar.
    // Kaynak artık sağlayıcıdan okunur; e-posta onay / sihirli bağlantı
    // akışları yanlışlıkla "Google" sayılmaz.
    if (!error) {
      try {
        const { data: { user } } = await supa.auth.getUser();
        if (user?.email) {
          const saglayici = String(
            (user.app_metadata as { provider?: string } | undefined)?.provider || "",
          );
          const ulke = await ulkeTespit(request);
          await takipKaydet({
            olay: "giris",
            kaynak: saglayici === "google" ? "google" : "parola",
            email: user.email.toLowerCase(),
            ulke,
            ip: ipTespit(request),
            cihaz: cihazTespit(request),
            yol: "/app",
          });
        }
      } catch {
        /* takip hatası girişe engel olmasın */
      }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
