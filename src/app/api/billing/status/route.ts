import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// GET /api/billing/status — üst bardaki abonelik düğmesi için hafif durum bilgisi.
export async function GET() {
  const ctx = await getAuthContext();
  if (ctx.mode === "local") {
    return NextResponse.json({ ok: true, mode: "local", sub: null });
  }
  if (!ctx.user || !ctx.business) {
    return NextResponse.json({ ok: false, error: "login-required" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    mode: "saas",
    sub: {
      plan: ctx.business.plan,
      gun: ctx.trialLeft,
      email: ctx.user.email,
      cancelled: ctx.business.status === "cancelled",
    },
  });
}
