import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function saasOn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Basit bellek içi rate limiter (IP başına dakikada N istek).
const RATE_LIMIT = 120; // req/min per IP
const pencere = 60_000;
const sayac = new Map<string, { n: number; t: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const v = sayac.get(ip);
  if (!v || now - v.t > pencere) {
    sayac.set(ip, { n: 1, t: now });
    return true;
  }
  v.n++;
  if (v.n > RATE_LIMIT) return false;
  return true;
}

export async function proxy(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const urlPath = req.nextUrl.pathname;
  if (urlPath.startsWith("/api/")) {
    if (!rateLimit(ip)) {
      return new NextResponse(JSON.stringify({ error: "Çok fazla istek. Lütfen bir dakika bekleyin." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
  }

  if (!saasOn()) return NextResponse.next();

  // FIX (döngü): Yanıt en başta oluşturulur ve tazelenen oturum çerezleri
  // DOĞRUDAN bu yanıta yazılır. Önceden yönlendirmelerde yeni yanıt
  // oluşturulduğu için tazelenen çerezler kayboluyor, oturum "yok" sayılıp
  // /giris ↔ /app arasında sonsuz yönlendirme oluşabiliyordu.
  const res = NextResponse.next();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supa.auth.getUser();

  const isApp = urlPath === "/app" || urlPath.startsWith("/app/");
  const isAuth = urlPath === "/giris" || urlPath.startsWith("/giris");
  // loop=1: /app oturumu göremediği için kullanıcıyı girişe attıysa, proxy onu
  // tekrar /app'e göndermez. Böylece döngü kırılır ve giriş sayfası açılır.
  const donguKoru = req.nextUrl.searchParams.get("loop") === "1";

  /** Yönlendirme: tazelenen çerezler yeni yanıta taşınır. */
  const yonlendir = (hedef: string) => {
    const r = NextResponse.redirect(hedef);
    res.cookies.getAll().forEach((c) => r.cookies.set(c.name, c.value, c));
    return r;
  };

  if (isApp && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/giris";
    url.searchParams.set("next", urlPath);
    url.searchParams.set("loop", "1");
    return yonlendir(url.toString());
  }
  if (isAuth && user && !donguKoru) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return yonlendir(url.toString());
  }
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/giris", "/api/:path*"],
};
