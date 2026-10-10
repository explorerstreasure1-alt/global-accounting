import { NextResponse } from "next/server";
import { resolveDb } from "@/lib/tenant";
import { billingEnv } from "@/lib/billing";

export const dynamic = "force-dynamic";

// POST /api/billing/cancel — panel içinden tek tıkla iptal.
// Lemon API ile aboneliği kapatır, hesabı free'ye düşürür (webhook da aynısını teyit eder).
export async function POST() {
  const { gate, business } = await resolveDb();
  if (gate) return gate;
  if (!business) return NextResponse.json({ error: "no-business" }, { status: 400 });

  const subId = business.lemon_subscription_id;
  if (!subId) {
    return NextResponse.json({ error: "no-subscription" }, { status: 404 });
  }

  const { apiKey } = billingEnv();
  if (!apiKey) {
    return NextResponse.json({ error: "billing-not-configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (res.status !== 200 && res.status !== 204) {
      const text = await res.text().catch(() => "");
      // Anahtar bozuksa kullanıcıya portal yolunu göster
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: "lemon-auth", detail: text.slice(0, 200) }, { status: 502 });
      }
      throw new Error(`Lemon cancel failed: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || "cancel failed" }, { status: 502 });
  }

  // Planı hemen free yap (webhook da teyit edecek)
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supa = await createClient();
    await supa.from("businesses").update({ plan: "free" }).eq("id", business.id);
  } catch { /* RLS/service yoksa webhook halleder */ }
  return NextResponse.json({ ok: true });
}
