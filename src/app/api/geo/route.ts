import { ulkeTespit } from "@/lib/ulke";

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
  // Vercel başlığı → yoksayılırsa IP bazlı önbellekli tespit (lib/ulke)
  const ulke = await ulkeTespit(request);

  const code = ulke || null;
  const dil = code ? (ULKE_DIL[code] || "en") : "en";
  return Response.json({ country: code, locale: dil });
}