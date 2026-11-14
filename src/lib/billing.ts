/**
 * Lemon Squeezy billing helper (global tailor SaaS).
 * Env: LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID,
 *      LEMONSQUEEZY_VARIANT_ID_GLOBAL ($5), LEMONSQUEEZY_VARIANT_ID_TR ($3/₺150)
 * Not: typo ile gelen LEMONSQUEEZY_* isimleri de desteklenir.
 */

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export function billingEnv() {
  const apiKey = env("LEMONSQUEEZY_API_KEY");
  const storeId = env("LEMONSQUEEZY_STORE_ID");
  const variantIdGlobal = env("LEMONSQUEEZY_VARIANT_ID_GLOBAL");
  const variantIdTr = env("LEMONSQUEEZY_VARIANT_ID_TR");
  return { apiKey, storeId, variantIdGlobal, variantIdTr };
}

export function billingConfigured(): boolean {
  const { apiKey, storeId, variantIdGlobal } = billingEnv();
  return Boolean(apiKey && storeId && variantIdGlobal);
}

/** API anahtarı çalışmazsa düğmeler doğrudan bu ödeme linkine gider. */
export const LEMON_DIRECT_URL =
  process.env.NEXT_PUBLIC_LEMON_CHECKOUT_URL ||
  "https://projeai.lemonsqueezy.com/checkout/buy/28a3f3c5-4f04-4a74-98df-bc8e7caa1f82";

/** Türkiye özel indirimli ödeme bağlantısı (doğrut link / fallback). */
export const LEMON_CHECKOUT_URL_TR =
  process.env.NEXT_PUBLIC_LEMON_CHECKOUT_URL_TR ||
  "https://projeai.lemonsqueezy.com/checkout/buy/ea03fa8e-bb14-40cf-821a-e0eea8ed520e";

/** Ülkeye göre variant ID döner. */
export function getVariantIdForCountry(country?: string): string | undefined {
  const { variantIdGlobal, variantIdTr } = billingEnv();
  if (country === "TR" && variantIdTr) return variantIdTr;
  return variantIdGlobal || undefined;
}

/** Ülkeye göre ödeme bağlantısı döner. Türkiye için TR variant / linki. */
export function getCheckoutUrlForCountry(country?: string): string {
  if (country === "TR") return LEMON_CHECKOUT_URL_TR;
  return LEMON_DIRECT_URL;
}

export type SubscriptionInfo = {
  status: string;
  endsAt: string | null;
  renewsAt: string | null;
  portalUrl: string | null;
};

type LemonSubscriptionPayload = {
  data?: {
    attributes?: {
      status?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      urls?: { customer_portal?: string | null };
    };
  };
};

function subscriptionInfo(json: LemonSubscriptionPayload): SubscriptionInfo {
  const a = json?.data?.attributes;
  return {
    status: a?.status || "unknown",
    endsAt: a?.ends_at ?? null,
    renewsAt: a?.renews_at ?? null,
    portalUrl: a?.urls?.customer_portal ?? null,
  };
}

/** Abonelik detayını Lemon'dan oku (iptal / portal bağlantısı için). */
export async function getSubscriptionInfo(subId: string): Promise<SubscriptionInfo> {
  const { apiKey } = billingEnv();
  if (!apiKey) throw new Error("billing-not-configured");
  const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lemon subscription failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return subscriptionInfo((await res.json()) as LemonSubscriptionPayload);
}

/** Aboneliği iptal et. Dönem sonuna kadar erişim sürer; webhook düşüşü yapar. */
export async function cancelLemonSubscription(subId: string): Promise<SubscriptionInfo | null> {
  const { apiKey } = billingEnv();
  if (!apiKey) throw new Error("billing-not-configured");
  const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (res.status === 404) return null; // zaten iptal edilmiş
  if (res.status !== 200 && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lemon cancel failed: ${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const json = (await res.json().catch(() => ({}))) as LemonSubscriptionPayload;
  return subscriptionInfo(json);
}

export async function createCheckoutUrl(opts: {
  email?: string;
  userId?: string;
  country?: string;
}): Promise<string> {
  const { apiKey, storeId } = billingEnv();
  if (!apiKey || !storeId) throw new Error("Billing not configured");

  const variantId = getVariantIdForCountry(opts.country);
  if (!variantId) throw new Error("Billing not configured: no variant for country");

  // Lemon Squeezy API v1: POST /v1/checkouts
  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: opts.email || undefined,
            custom: opts.userId ? { user_id: opts.userId } : undefined,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lemon checkout failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = json?.data?.attributes?.url;
  if (!url) throw new Error("Lemon checkout URL missing");
  return url;
}
