import { billingConfigured, createCheckoutUrl, getCheckoutUrlForCountry } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      userId?: string;
      country?: string;
      locale?: string;
    };

    // API anahtarı yoksa ülkeye göre doğrudan bağlantıya düş
    if (!billingConfigured()) {
      return Response.json({ ok: true, url: getCheckoutUrlForCountry(body.country) });
    }

    try {
      const url = await createCheckoutUrl({
        email: body.email,
        userId: body.userId,
        country: body.country,
      });
      return Response.json({ ok: true, url });
    } catch {
      // API hatası durumunda ülkeye göre doğrudan bağlantı
      return Response.json({ ok: true, url: getCheckoutUrlForCountry(body.country) });
    }
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error)?.message || "checkout failed" }, { status: 502 });
  }
}
