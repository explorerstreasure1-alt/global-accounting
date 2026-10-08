import { billingConfigured, createCheckoutUrl } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!billingConfigured()) {
    return Response.json({ ok: false, error: "Billing not configured" }, { status: 500 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; userId?: string };
    const url = await createCheckoutUrl({ email: body.email, userId: body.userId });
    return Response.json({ ok: true, url });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error)?.message || "checkout failed" }, { status: 500 });
  }
}
