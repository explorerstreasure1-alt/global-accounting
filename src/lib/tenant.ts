import { createClient } from "./supabase/server";
import { tenantDb, fileDb, type TenantDb } from "./data-tenant";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  locale: string;
  currency: string;
  plan: "free" | "pro";
  status: string;
  trial_ends_at: string;
  lemon_customer_id: string | null;
  lemon_subscription_id: string | null;
};

export type AuthContext =
  | { mode: "local" }
  | { mode: "saas"; user: { id: string; email: string } | null; business: Business | null; canUse: boolean; trialLeft: number };

export function saasConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Sunucu tarafı: oturum + işletme + trial durumu. RLS her şeyi ayrıca kilitler. */
export async function getAuthContext(): Promise<AuthContext> {
  if (!saasConfigured()) return { mode: "local" };
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { mode: "saas", user: null, business: null, canUse: false, trialLeft: 0 };
  const { data: biz } = await supa
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (!biz) {
    // Trigger henüz çalışmadıysa bekle ve tekrar dene
    await new Promise((r) => setTimeout(r, 800));
    const retry = await supa.from("businesses").select("*").eq("owner_id", user.id).limit(1).single();
    if (!retry.data) {
      return { mode: "saas", user: { id: user.id, email: user.email ?? "" }, business: null, canUse: false, trialLeft: 0 };
    }
    return ctxFor(user.id, user.email ?? "", retry.data as Business);
  }
  return ctxFor(user.id, user.email ?? "", biz as Business);
}

function ctxFor(uid: string, email: string, b: Business): AuthContext {
  const left = Math.ceil((new Date(b.trial_ends_at).getTime() - Date.now()) / 86400000);
  const canUse = b.plan === "pro" || left > 0;
  return { mode: "saas", user: { id: uid, email }, business: b, canUse, trialLeft: left };
}

/**
 * API route helper: oturumu çözer, kiracı DB'sini verir.
 * local modda dosya DB'si; girișsizde 401, kilitlide 403 Response döner.
 */
export async function resolveDb(): Promise<{ db: TenantDb; business: Business | null; gate?: Response }> {
  const ctx = await getAuthContext();
  if (ctx.mode === "local") return { db: await fileDb(), business: null };
  if (ctx.mode === "saas" && (!ctx.user || !ctx.business)) {
    return { db: await fileDb(), business: null, gate: Response.json({ error: "login-required" }, { status: 401 }) };
  }
  if (ctx.mode === "saas" && !ctx.canUse) {
    return { db: await fileDb(), business: null, gate: Response.json({ error: "trial-expired" }, { status: 403 }) };
  }
  const supa = await createClient();
  const b = (ctx as Extract<AuthContext, { mode: "saas" }>).business!;
  return { db: tenantDb(supa, b.id, b.name), business: b };
}
