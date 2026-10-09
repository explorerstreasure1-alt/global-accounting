import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function saasOn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function middleware(req: NextRequest) {
  if (!saasOn()) return NextResponse.next();

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

  const path = req.nextUrl.pathname;
  const isApp = path === "/app" || path.startsWith("/app/");
  const isAuth = path === "/giris" || path.startsWith("/giris");

  if (isApp && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/giris";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (isAuth && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/giris"],
};
