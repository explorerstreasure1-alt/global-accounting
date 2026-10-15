import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
    await supa.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
