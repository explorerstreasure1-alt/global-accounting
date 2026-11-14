import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhook: /api/billing/webhook
 * Dashboard → Settings → Webhooks → signing secret → LEMONSQUEEZY_WEBHOOK_SECRET
 *
 * Davranış:
 *  - subscription_created / updated / resumed / unpaused / order_created
 *    → plan="pro", status="active", subscription_ends_at = ends_at (dönem sonu)
 *    Kullanıcı ödemeye devam ettiği sürece uygulama kilitlenmez.
 *  - subscription_cancelled
 *    → status="cancelled", plan="pro" korunur (grace period: dönem sonuna kadar erişim)
 *  - subscription_expired
 *    → plan="free", status="expired" (ödeme bitti, erişim kapatılır)
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
  let bytes: Uint8Array;
  try {
    const cift = sig.match(/.{2}/g);
    if (!cift) return false;
    bytes = Uint8Array.from(cift.map((b) => parseInt(b, 16)));
    if (bytes.some((n) => Number.isNaN(n))) return false;
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", key, bytes.buffer as ArrayBuffer, new TextEncoder().encode(raw));
}

type LemonEvent = {
  meta?: { event_name?: string; custom_data?: { user_id?: string } };
  data?: {
    id?: string;
    attributes?: {
      customer_id?: number | string;
      status?: string;
      user_email?: string;
      user_name?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      order_id?: number | string;
    };
  };
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
  const orderId = ev?.data?.attributes?.order_id != null ? String(ev.data.attributes.order_id) : null;
  const buyerEmail = ev?.data?.attributes?.user_email || null;
  const lemonStatus = ev?.data?.attributes?.status || null;
  const endsAt = ev?.data?.attributes?.ends_at ?? null;

  async function ownerIdFor(): Promise<string | null> {
    if (userId) return userId;
    // Direkt linkle ödeyenler: e-postadan kullanıcıyı bul
    if (buyerEmail && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supa0 = await createServiceClient();
        let page = 1;
        for (;;) {
          const { data, error } = await supa0.auth.admin.listUsers({ page, perPage: 100 });
          if (error || !data?.users?.length) break;
          const hit = data.users.find((u) => u.email?.toLowerCase() === buyerEmail.toLowerCase());
          if (hit) return hit.id;
          if (data.users.length < 100) break;
          page += 1;
        }
      } catch { /* eşleşemezse pro açılamaz, logda kalır */ }
    }
    return null;
  }

  const ownerId = await ownerIdFor();
  if (ownerId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supa = await createServiceClient();

      if (
        name === "subscription_created" ||
        name === "subscription_updated" ||
        name === "subscription_resumed" ||
        name === "subscription_unpaused" ||
        name === "order_created"
      ) {
        // Abonelik aktif/yeni → pro aç, bitiş tarihini kaydet.
        // Lemon "updated" olayını her değişiklikte gönderir; ends_at her seferinde güncellenir.
        const expired = lemonStatus === "expired";
        const cancelled = lemonStatus === "cancelled";
        await supa
          .from("businesses")
          .update({
            plan: expired ? "free" : "pro",
            status: expired ? "expired" : cancelled ? "cancelled" : "active",
            lemon_customer_id: custId,
            lemon_subscription_id: subId,
            lemon_order_id: orderId,
            subscription_ends_at: endsAt,
          })
          .eq("owner_id", ownerId);
        console.log(
          "[billing webhook] subscription synced for",
          ownerId,
          lemonStatus || name,
          "ends_at:",
          endsAt,
        );
      } else if (name === "subscription_cancelled") {
        // İptal edildi ama ödeme yapılan dönem sonuna kadar erişim sürer (grace period).
        // plan="pro" kalır, yalnızca status="cancelled" yapılır; webhook expired gelince free'ye düşer.
        await supa
          .from("businesses")
          .update({ status: "cancelled", subscription_ends_at: endsAt })
          .eq("owner_id", ownerId);
        console.log("[billing webhook] subscription cancelled (grace period) for", ownerId, "ends_at:", endsAt);
      } else if (name === "subscription_expired") {
        // Dönem bendi + ödeme yapılmadı → free'ye düş, erişim kısıtlanır.
        await supa
          .from("businesses")
          .update({ plan: "free", status: "expired" })
          .eq("owner_id", ownerId);
        console.log("[billing webhook] downgraded to free for", ownerId);
      }
    } catch (e) {
      console.error("[billing webhook] db error:", (e as Error)?.message);
    }
  } else {
    console.log("[billing webhook] no owner match", { name, userId, buyerEmail });
  }
  return Response.json({ ok: true, event: name });
}
