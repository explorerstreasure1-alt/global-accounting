import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/tenant";
import { cancelLemonSubscription } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/billing/cancel — panel içinden tek tıkla iptal.
// Lemon aboneliğini iptal eder; erişim dönem sonuna kadar sürer.
// Planı hemen düşürmeyiz: webhook subscription_expired gelince free'ye iner.
export async function POST() {
  const ctx = await getAuthContext();
  if (ctx.mode === "local") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }
  if (!ctx.user || !ctx.business) {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const subId = ctx.business.lemon_subscription_id;
  if (!subId) {
    return NextResponse.json({ error: "no-subscription" }, { status: 404 });
  }

  let info = null;
  try {
    info = await cancelLemonSubscription(subId);
  } catch (e) {
    const message = (e as Error)?.message || "cancel failed";
    if (message.includes("billing-not-configured")) {
      return NextResponse.json({ error: "billing-not-configured" }, { status: 500 });
    }
    if (message.includes("401") || message.includes("403")) {
      // API anahtarı bozuksa kullanıcıya portal / fatura e-postası yolunu göster
      return NextResponse.json({ error: "lemon-auth", detail: message.slice(0, 200) }, { status: 502 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // İptal edildi işareti: kullanıcı tekrar tekrar iptal etmeye çalışmasın.
  // Plan pro kalır, dönem sonunda webhook free'ye çeker.
  try {
    const supa = await createClient();
    await supa
      .from("businesses")
      .update({ status: "cancelled" })
      .eq("id", ctx.business.id);
  } catch {
    /* RLS/service yoksa webhook halleder */
  }

  return NextResponse.json({
    ok: true,
    cancelled: true,
    endsAt: info?.endsAt ?? null,
  });
}
