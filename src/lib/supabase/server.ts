import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* Server Component'ten çağrıldıysa yoksay */
          }
        },
      },
    },
  );
}

/** Service-role istemci: webhook/imza doğrulama gibi güvenli işler için. SADECE sunucuda. */
export async function createServiceClient() {
  const { createClient: createSupa } = await import("@supabase/supabase-js");
  return createSupa(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
