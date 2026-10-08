export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhook karşılayıcı (iskelet).
 * Dashboard'da URL: /api/billing/webhook
 * TODO: LEMONSQUEEZY_WEBHOOK_SECRET ile imza doğrula, user'a pro plan yaz.
 */
export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  let event = "";
  try {
    const json = JSON.parse(raw || "{}") as { meta?: { event_name?: string } };
    event = json?.meta?.event_name || "";
  } catch {
    event = "";
  }
  // Şimdilik sadece logla, 200 dön (Lemon retry yapmasın)
  console.log("[billing webhook]", event || "unknown", raw.slice(0, 500));
  return Response.json({ ok: true, event });
}
