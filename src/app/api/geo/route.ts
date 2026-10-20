export const dynamic = "force-dynamic";

const ULKE_DIL: Record<string, string> = {
  TR: "tr",
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru", TJ: "ru", UZ: "ru", UA: "ru",
  DE: "de", AT: "de", CH: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", MA: "fr", DZ: "fr", TN: "fr", SN: "fr", CI: "fr", CM: "fr",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es",
  SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", YE: "ar", IQ: "ar", SY: "ar", JO: "ar", LB: "ar", EG: "ar", LY: "ar", SD: "ar", SO: "ar", DJ: "ar", KM: "ar",
  IR: "fa", AF: "fa",
  IL: "he", PS: "he",
};

export async function GET(request: Request) {
  let ulke = (request.headers.get("x-vercel-ip-country") || "").toUpperCase();

  // 2) Yerel geliştirme / Vercel dışı: birden fazla ücretsiz API (yedekli)
  if (!ulke) {
    const kaynaklar = [
      async () => {
        const r = await fetch("http://ip-api.com/json/?fields=countryCode", { cache: "no-store" });
        if (!r.ok) return "";
        const j = (await r.json()) as { countryCode?: string };
        return (j.countryCode || "").toUpperCase();
      },
      async () => {
        const r = await fetch("https://ipinfo.io/json", { cache: "no-store" });
        if (!r.ok) return "";
        const j = (await r.json()) as { country?: string };
        return (j.country || "").toUpperCase();
      },
    ];
    for (const k of kaynaklar) {
      try {
        const kod = await k();
        if (kod) { ulke = kod; break; }
      } catch {
        /* sıradaki kaynağa geç */
      }
    }
  }

  const code = ulke || null;
  const dil = code ? (ULKE_DIL[code] || "en") : "en";
  return Response.json({ country: code, locale: dil });
}