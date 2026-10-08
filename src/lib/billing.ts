/**
 * Lemon Squeezy billing helper (global tailor SaaS).
 * Env: LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID
 * Not: typo ile gelen LEMONSQUEEZY_* isimleri de desteklenir.
 */

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export function billingEnv() {
  const apiKey = env("LEMONSQUEEZY_API_KEY") || env("LEMONSQUEEZY_API_KEY");
  const storeId = env("LEMONSQUEEZY_STORE_ID") || env("LEMONSQUEEZY_STORE_ID");
  const variantId = env("LEMONSQUEEZY_VARIANT_ID") || env("LEMONSQUEEZY_VARIANT_ID");
  return { apiKey, storeId, variantId };
}

export function billingConfigured(): boolean {
  const { apiKey, storeId, variantId } = billingEnv();
  return Boolean(apiKey && storeId && variantId);
}

export async function createCheckoutUrl(opts: { email?: string; userId?: string }): Promise<string> {
  const { apiKey, storeId, variantId } = billingEnv();
  if (!apiKey || !storeId || !variantId) throw new Error("Billing not configured");

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
