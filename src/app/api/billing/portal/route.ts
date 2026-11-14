import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/tenant";
import { getSubscriptionInfo } from "@/lib/billing";

export const dynamic = "force-dynamic";

// GET /api/billing/portal — Lemon müşteri portalı (kart güncelleme / yeniden açma).
export async function GET() {
  const ctx = await getAuthContext();
  if (ctx.mode === "local" || !ctx.user || !ctx.business) {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }
  const subId = ctx.business.lemon_subscription_id;
  if (!subId) {
    return NextResponse.json({ error: "no-subscription" }, { status: 404 });
  }
  try {
    const info = await getSubscriptionInfo(subId);
    if (!info.portalUrl) {
      return NextResponse.json({ error: "portal-unavailable" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, url: info.portalUrl });
  } catch (e) {
    const message = (e as Error)?.message || "portal failed";
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 502 });
  }
}
