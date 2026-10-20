// Ülke tespiti: Vercel geo başlığı (x-vercel-ip-country) veya ücretsiz IP API.
// İlk açılışta seçili dil yoksa bu uçtan gelen ülke koduna göre dil seçilir.
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
  // 1) Vercel geo başlığı
  let ulke = request.headers.get("x-vercel-ip-country") || "";
  // 2) Yerel geliştirme / Vercel dışı: ücretsiz IP API
  if (!ulke) {
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { country_code?: string };
        ulke = j.country_code || "";
      }
    } catch {
      ulke = "";
    }
  }
  const code = (ulke || "").toUpperCase();
  const dil = ULKE_DIL[code] || "en";
  return Response.json({ country: code || null, locale: dil });
}