import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhook: /api/billing/webhook
 * Dashboard → Settings → Webhooks → signing secret → LEMONSQUEEZY_WEBHOOK_SECRET
 * Olaylar: subscription_created/updated → pro aç, subscription_cancelled/expired → free'ye düşür.
 */

async function verifySignature(raw: string, sig: string | null): Promise<boolean> {
  const secret = (process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "").trim();
  if (!secret) return true; // secret yoksa kabul et (logla) — kurulum aşaması
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(sig.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify("HMAC", key, bytes.buffer as ArrayBuffer, new TextEncoder().encode(raw));
}

type LemonEvent = {
  meta?: { event_name?: string; custom_data?: { user_id?: string } };
  data?: { id?: string; attributes?: { customer_id?: number | string; status?: string } };
};

export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  const sig = req.headers.get("x-signature");
  if (!(await verifySignature(raw, sig))) {
    console.error("[billing webhook] bad signature");
    return Response.json({ ok: false }, { status: 401 });
  }
  let ev: LemonEvent = {};
  try {
    ev = JSON.parse(raw || "{}") as LemonEvent;
  } catch { /* ignore */ }
  const name = ev?.meta?.event_name || "unknown";
  console.log("[billing webhook]", name);

  const userId = ev?.meta?.custom_data?.user_id;
  const subId = ev?.data?.id ? String(ev.data.id) : null;
  const custId = ev?.data?.attributes?.customer_id != null ? String(ev.data.attributes.customer_id) : null;

  if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supa = await createServiceClient();
      if (name === "subscription_created" || name === "subscription_updated" || name === "order_created") {
        await supa.from("businesses").update({
          plan: "pro",
          lemon_customer_id: custId,
          lemon_subscription_id: subId,
        }).eq("owner_id", userId);
        console.log("[billing webhook] pro opened for", userId);
      } else if (name === "subscription_cancelled" || name === "subscription_expired") {
        await supa.from("businesses").update({ plan: "free" }).eq("owner_id", userId);
        console.log("[billing webhook] downgraded to free for", userId);
      }
    } catch (e) {
      console.error("[billing webhook] db error:", (e as Error)?.message);
    }
  }
  return Response.json({ ok: true, event: name });
}
